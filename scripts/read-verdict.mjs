import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, dnsEncode, namehash } from 'ethers';

const CHAIN_ID = 11155111;
const UNIVERSAL_RESOLVER = '0xd26f2040d083af1cd2962ba303f4bea0c4faf142';
const DEFAULT_NAME = 'usd-yield-001.acme.verdict.eth';
const FRESH_SECONDS = 86_400;
const universalAbi = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const textInterface = new Interface(['function text(bytes32 node,string key) view returns (string)']);

function envFile() {
  const values = {};
  for (const line of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
    const at = line.indexOf('=');
    if (at > 0 && !line.trimStart().startsWith('#')) values[line.slice(0, at)] = line.slice(at + 1);
  }
  return values;
}

function evaluate(evidence) {
  if (!evidence.available) return 'UNAVAILABLE';
  if (evidence.revoked || evidence.daysRemaining <= 0 || !evidence.fresh || evidence.riskConflict) return 'BLOCKED';
  if (evidence.daysRemaining < 14) return 'REVIEW';
  return 'POLICY_PASS';
}

async function main() {
  const name = (process.argv[2] || DEFAULT_NAME).toLowerCase();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || envFile().SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is missing');
  const provider = new JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true });
  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  const universal = new Contract(UNIVERSAL_RESOLVER, universalAbi, provider);

  async function text(recordName, key) {
    const query = textInterface.encodeFunctionData('text', [namehash(recordName), key]);
    const [raw, resolver] = await universal.resolve(dnsEncode(recordName), query, { blockTag: blockNumber });
    return { value: String(textInterface.decodeFunctionResult('text', raw)[0]), resolver };
  }

  const audit = (await text(name, 'verdict.asset.attestation')).value;
  const observation = (await text(name, 'verdict.asset.observation')).value;
  const [auditSubject, auditExpiry, auditStatus, riskSubject, observedAt, severity, reasonCode, riskStatus] = await Promise.all([
    text(audit, 'verdict.subject'),
    text(audit, 'verdict.attestation.expiresAt'),
    text(audit, 'verdict.attestation.status'),
    text(observation, 'verdict.subject'),
    text(observation, 'verdict.observation.observedAt'),
    text(observation, 'verdict.observation.severity'),
    text(observation, 'verdict.observation.reasonCode'),
    text(observation, 'verdict.observation.status'),
  ]);
  if (auditSubject.value !== name || riskSubject.value !== name) throw new Error('Evidence subject mismatch');

  const now = block.timestamp;
  const expiry = Number(auditExpiry.value);
  const observed = Number(observedAt.value);
  const evidence = {
    available: true,
    revoked: auditStatus.value.toLowerCase() !== 'active',
    daysRemaining: Math.floor((expiry - now) / 86_400),
    fresh: observed <= now && now - observed <= FRESH_SECONDS,
    riskConflict:
      riskStatus.value.toLowerCase() !== 'active' ||
      ['high', 'critical', 'conflict'].includes(severity.value.toLowerCase()) ||
      reasonCode.value.toUpperCase().includes('CONFLICT'),
  };

  console.log(JSON.stringify({
    client: 'independent-cli',
    chainId: CHAIN_ID,
    sourceBlock: blockNumber,
    universalResolver: UNIVERSAL_RESOLVER,
    name,
    audit,
    observation,
    evidence,
    state: evaluate(evidence),
    resolvers: {
      audit: auditSubject.resolver,
      observation: riskSubject.resolver,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
