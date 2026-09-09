import { Contract, Interface, JsonRpcProvider, dnsEncode, namehash } from 'ethers';
import { ENSV2_SEPOLIA, VERDICT_POLICY } from './ensv2-config';
import { evaluate, type Evidence } from './policy';
import type { RecordSource, VerdictApiResponse } from './verdict-types';

const UNIVERSAL_RESOLVER_ABI = [
  'function resolve(bytes name,bytes data) view returns (bytes result,address resolver)',
];
const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const textInterface = new Interface(TEXT_ABI);

let provider: JsonRpcProvider | undefined;

function getProvider() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  provider ??= new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
  return provider;
}

async function readRecords(
  resolver: Contract,
  name: string,
  keys: readonly string[],
  blockTag: number,
): Promise<RecordSource> {
  const encodedName = dnsEncode(name);
  const node = namehash(name);
  const rows = await Promise.all(keys.map(async (key) => {
    const query = textInterface.encodeFunctionData('text', [node, key]);
    const [raw, answerResolver] = await resolver.resolve(encodedName, query, { blockTag });
    const [value] = textInterface.decodeFunctionResult('text', raw);
    return { key, value: String(value), resolver: String(answerResolver) };
  }));
  const answerResolver = rows[0]?.resolver ?? '';
  if (rows.some((row) => row.resolver.toLowerCase() !== answerResolver.toLowerCase())) {
    throw new Error(`Resolver changed within pinned read for ${name}`);
  }
  return {
    name,
    resolver: answerResolver,
    records: Object.fromEntries(rows.map(({ key, value }) => [key, value])),
  };
}

function unix(value: string) {
  if (!/^\d+$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function required(value: string | undefined, field: string) {
  if (!value) throw new Error(`Missing required ENS record: ${field}`);
  return value;
}

function deploymentAddress(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const address = parsed[`eip155:${ENSV2_SEPOLIA.chainId}`];
    return typeof address === 'string' ? address : '';
  } catch {
    return '';
  }
}

export async function resolveVerdict(name: string = ENSV2_SEPOLIA.names.asset): Promise<VerdictApiResponse> {
  const rpc = getProvider();
  const sourceBlock = await rpc.getBlockNumber();
  const block = await rpc.getBlock(sourceBlock);
  if (!block) throw new Error(`Sepolia block ${sourceBlock} is unavailable`);

  const universal = new Contract(
    ENSV2_SEPOLIA.contracts.universalResolver,
    UNIVERSAL_RESOLVER_ABI,
    rpc,
  );

  const assetSource = await readRecords(universal, name, [
    'verdict.schema',
    'verdict.asset.displayName',
    'verdict.asset.ticker',
    'verdict.asset.issuer',
    'verdict.asset.class',
    'verdict.asset.documentUri',
    'verdict.asset.deployments',
    'verdict.asset.status',
    'verdict.asset.attestation',
    'verdict.asset.observation',
  ], sourceBlock);

  const auditName = required(assetSource.records['verdict.asset.attestation'], 'verdict.asset.attestation');
  const observationName = required(assetSource.records['verdict.asset.observation'], 'verdict.asset.observation');
  const [auditSource, observationSource] = await Promise.all([
    readRecords(universal, auditName, [
      'verdict.schema',
      'verdict.subject',
      'verdict.attestation.auditor',
      'verdict.attestation.documentHash',
      'verdict.attestation.issuedAt',
      'verdict.attestation.expiresAt',
      'verdict.attestation.status',
      'verdict.attestation.methodologyUri',
      'verdict.attestation.ai.model',
      'verdict.attestation.ai.confidence',
      'verdict.attestation.ai.rationale',
      'verdict.attestation.ai.sourceHash',
    ], sourceBlock),
    readRecords(universal, observationName, [
      'verdict.schema',
      'verdict.subject',
      'verdict.observation.monitor',
      'verdict.observation.observedAt',
      'verdict.observation.severity',
      'verdict.observation.reasonCode',
      'verdict.observation.evidenceUri',
      'verdict.observation.status',
      'verdict.observation.ai.model',
      'verdict.observation.ai.confidence',
      'verdict.observation.ai.rationale',
      'verdict.observation.ai.sourceHash',
    ], sourceBlock),
  ]);

  if (auditSource.records['verdict.subject'] !== name || observationSource.records['verdict.subject'] !== name) {
    throw new Error('Independent evidence subject does not match the requested asset');
  }

  const expiresAt = unix(auditSource.records['verdict.attestation.expiresAt']);
  const observedAt = unix(observationSource.records['verdict.observation.observedAt']);
  if (!expiresAt || !observedAt) throw new Error('Evidence timestamps are missing or invalid');

  const now = block.timestamp;
  const auditStatus = auditSource.records['verdict.attestation.status'].toLowerCase();
  const observationStatus = observationSource.records['verdict.observation.status'].toLowerCase();
  const severity = observationSource.records['verdict.observation.severity'].toLowerCase();
  const reasonCode = observationSource.records['verdict.observation.reasonCode'].toUpperCase();
  const evidence: Evidence = {
    available: true,
    revoked: auditStatus !== 'active',
    daysRemaining: Math.floor((expiresAt - now) / 86_400),
    fresh: observedAt <= now && now - observedAt <= VERDICT_POLICY.observationFreshnessSeconds,
    riskConflict:
      observationStatus !== 'active' ||
      ['high', 'critical', 'conflict'].includes(severity) ||
      reasonCode.includes('CONFLICT'),
  };
  const verdict = evaluate(evidence);

  return {
    ok: true,
    name,
    chainId: ENSV2_SEPOLIA.chainId,
    sourceBlock,
    evaluatedAt: now,
    policyId: VERDICT_POLICY.id,
    state: verdict.state,
    reason: verdict.reason,
    evidence,
    asset: {
      displayName: required(assetSource.records['verdict.asset.displayName'], 'verdict.asset.displayName'),
      ticker: required(assetSource.records['verdict.asset.ticker'], 'verdict.asset.ticker'),
      assetClass: required(assetSource.records['verdict.asset.class'], 'verdict.asset.class'),
      issuer: required(assetSource.records['verdict.asset.issuer'], 'verdict.asset.issuer'),
      documentUri: assetSource.records['verdict.asset.documentUri'],
      deployment: deploymentAddress(assetSource.records['verdict.asset.deployments']),
      status: assetSource.records['verdict.asset.status'],
    },
    audit: {
      name: auditName,
      auditor: auditSource.records['verdict.attestation.auditor'],
      documentHash: auditSource.records['verdict.attestation.documentHash'],
      issuedAt: unix(auditSource.records['verdict.attestation.issuedAt']),
      expiresAt,
      status: auditSource.records['verdict.attestation.status'],
      ai: {
        model: auditSource.records['verdict.attestation.ai.model'],
        confidence: unix(auditSource.records['verdict.attestation.ai.confidence']),
        rationale: auditSource.records['verdict.attestation.ai.rationale'],
        sourceHash: auditSource.records['verdict.attestation.ai.sourceHash'],
      },
    },
    observation: {
      name: observationName,
      monitor: observationSource.records['verdict.observation.monitor'],
      observedAt,
      severity: observationSource.records['verdict.observation.severity'],
      reasonCode: observationSource.records['verdict.observation.reasonCode'],
      status: observationSource.records['verdict.observation.status'],
      ai: {
        model: observationSource.records['verdict.observation.ai.model'],
        confidence: unix(observationSource.records['verdict.observation.ai.confidence']),
        rationale: observationSource.records['verdict.observation.ai.rationale'],
        sourceHash: observationSource.records['verdict.observation.ai.sourceHash'],
      },
    },
    sources: [assetSource, auditSource, observationSource],
    infrastructure: {
      universalResolver: ENSV2_SEPOLIA.contracts.universalResolver,
      registries: [
        ENSV2_SEPOLIA.proxies.verdictRegistry,
        ENSV2_SEPOLIA.proxies.acmeRegistry,
        ENSV2_SEPOLIA.proxies.auditorRegistry,
        ENSV2_SEPOLIA.proxies.monitorRegistry,
      ],
    },
  };
}

export function unavailableVerdict(name: string, reason: string): VerdictApiResponse {
  const evidence: Evidence = {
    available: false,
    revoked: false,
    daysRemaining: 0,
    fresh: false,
    riskConflict: false,
  };
  const verdict = evaluate(evidence);
  return {
    ok: false,
    name,
    chainId: ENSV2_SEPOLIA.chainId,
    sourceBlock: null,
    evaluatedAt: Math.floor(Date.now() / 1000),
    policyId: VERDICT_POLICY.id,
    state: verdict.state,
    reason: `${verdict.reason} ${reason}`,
    evidence,
    asset: null,
    audit: null,
    observation: null,
    sources: [],
    infrastructure: {
      universalResolver: ENSV2_SEPOLIA.contracts.universalResolver,
      registries: [],
    },
  };
}
