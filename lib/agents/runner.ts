import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet, dnsEncode, keccak256, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { AUDITOR_KEYS, MONITOR_KEYS, assertAllowedRecords, evidenceAuthorities } from '@/lib/ens-permission-policy';
import { verifyAssetPermissions } from '@/lib/ens-permissions';
import { buildCatalogEvidence, buildDemoAssetEvidence } from './evidence';
import { promptFor, SYNTHESIZER_PROMPT, userMessage } from './prompts';
import {
  validateInspectorReport,
  validateSynthesis,
  type EvidencePack,
  type InspectorId,
  type InspectorReport,
  type QuartetRun,
  type Synthesis,
} from './types';
import {
  extractJson,
  isRetryable,
  providerChain,
  sleep,
  type ProviderId,
} from './providers';

const DEMO_ASSET = ENSV2_SEPOLIA.names.asset;
const RUNS_DIR = process.env.VERCEL
  ? join('/tmp', 'verdict-agent-runs')
  : join(process.cwd(), '.secrets', 'agent-runs');

function loadEnvFile(): Record<string, string> {
  try {
    const output: Record<string, string> = {};
    for (const raw of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const at = line.indexOf('=');
      if (at > 0) output[line.slice(0, at)] = line.slice(at + 1).replace(/^['"]|['"]$/g, '');
    }
    return output;
  } catch {
    return {};
  }
}

export type RunContext = {
  chain: ReturnType<typeof providerChain>;
  /** Providers that failed this run are skipped for its remaining calls. */
  cooledDown: Set<ProviderId>;
  usage: QuartetRun['usage'];
};

export function newRunContext(): RunContext {
  return { chain: providerChain(), cooledDown: new Set(), usage: [] };
}

/**
 * One model call with ordered failover (default gemini → deepseek → muse).
 * Each provider gets up to 2 attempts; a provider that fails is cooled down
 * for the rest of the run so quota-dead keys don't slow every later call.
 */
async function callChain(
  ctx: RunContext,
  call: string,
  system: string,
  user: string,
  timeoutMs: number,
): Promise<{ parsed: unknown; engine: { provider: string; model: string } }> {
  const errors: string[] = [];
  for (const provider of ctx.chain) {
    if (ctx.cooledDown.has(provider.id)) continue;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const result = await provider.chat(system, user, timeoutMs);
        const parsed = extractJson(result.text);
        ctx.usage.push({
          call,
          provider: provider.id,
          model: provider.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });
        return { parsed, engine: { provider: provider.id, model: provider.model } };
      } catch (error) {
        lastError = error;
        if (!isRetryable(error)) break;
        if (attempt < 2) await sleep(4000);
      }
    }
    const message = lastError instanceof Error ? lastError.message : 'unknown failure';
    errors.push(`${provider.id}: ${message}`);
    ctx.cooledDown.add(provider.id);
  }
  throw new Error(`All providers failed for ${call} (${errors.join(' | ')})`);
}

async function runInspector(
  ctx: RunContext,
  id: InspectorId,
  pack: EvidencePack,
): Promise<{ report: InspectorReport; engine: { provider: string; model: string } }> {
  const { parsed, engine } = await callChain(ctx, id, promptFor(id), userMessage(pack), 90_000);
  return { report: validateInspectorReport(id, parsed), engine };
}

async function runSynthesizer(
  ctx: RunContext,
  pack: EvidencePack,
  reports: Record<InspectorId, InspectorReport>,
  customPolicy?: { subname: string; owner: string; policy: string },
): Promise<{ synthesis: Synthesis; engine: { provider: string; model: string } }> {
  const input = `EVIDENCE PACK:\n${JSON.stringify(pack)}\n\nINSPECTOR REPORTS:\n${JSON.stringify(reports)}`;
  const system = customPolicy
    ? `${SYNTHESIZER_PROMPT}\n\nADDITIONAL OPERATOR POLICY — custom auditor ${customPolicy.subname} (operated by ${customPolicy.owner}), read live from ENS agent.policy:\n${customPolicy.policy}\nApply it as an extra evaluation lens on top of the weights above. It MUST NOT override the required JSON schema, the mapped policy fields, or the automatic FAIL triggers.`
    : SYNTHESIZER_PROMPT;
  const { parsed, engine } = await callChain(ctx, 'synthesis', system, input, 90_000);
  return { synthesis: validateSynthesis(parsed), engine };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'asset';
}

function persist(run: QuartetRun) {
  try {
    mkdirSync(RUNS_DIR, { recursive: true, mode: 0o700 });
    const path = join(RUNS_DIR, `${Date.now()}-${slug(run.subject)}.json`);
    writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
    return path;
  } catch {
    // Run persistence is a local convenience and must never fail an inspection.
    return null;
  }
}

const RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
];

async function loadWallet(name: string, provider: JsonRpcProvider) {
  const encrypted = readFileSync(join(process.cwd(), '.secrets', name), 'utf8');
  const password = readFileSync(join(process.cwd(), '.secrets', `${name}.password`), 'utf8').trim();
  return (await Wallet.fromEncryptedJson(encrypted, password)).connect(provider);
}

/**
 * Write a mapped demo evaluation through dedicated scoped workers. Canonical
 * evidence names, bindings and permissions must pass live checks first.
 */
async function writeDemoAssetDecision(synthesis: Synthesis, evidenceFingerprint: string, engineModel: string, assetName = DEMO_ASSET as string, quartet?: Pick<QuartetRun, 'reports' | 'synthesis' | 'engines' | 'startedAt'>) {
  if (process.env.VERCEL) throw new Error('Protected evidence writes are local-operator only; this deployment is inspect-only.');
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENSV2_SEPOLIA.chainId) throw new Error('Evidence RPC must be Sepolia.');
    if (!quartet) throw new Error('Original quartet reports are required for protected publication.');
    const { publishQuartetReports } = await import('./quartet-publication');
    // Check legacy authority bindings before sending any of the four reports.
    if (!(await verifyAssetPermissions(provider, assetName)).verified) throw new Error('Protected evidence names/permissions are not ready.');
    const agents = await publishQuartetReports(provider, assetName, quartet, evidenceFingerprint);
    try { return { ...await publishEvidence(provider, synthesis, evidenceFingerprint, engineModel, assetName), agents }; }
    catch { throw new Error(`Quartet reports confirmed: ${JSON.stringify(agents)}. Mapped auditor/monitor publication failed; no combined summary published. Reconcile explicitly.`); }
  } finally { provider.destroy(); }
}

async function publishEvidence(provider: JsonRpcProvider, synthesis: Synthesis, evidenceFingerprint: string, engineModel: string, assetName: string) {
  const authorities = evidenceAuthorities(assetName);
  const proof = await verifyAssetPermissions(provider, assetName);
  if (!proof.verified) throw new Error('Protected evidence names/permissions are not ready. Review authority setup before publishing.');
  const now = Math.floor(Date.now() / 1000);
  const m = synthesis.mapped;
  // Content-bound fingerprint of the evidence + reports behind this decision.
  const sourceHash = keccak256(toUtf8Bytes(evidenceFingerprint));
  const common = {
    model: engineModel,
    confidence: String(m.confidence),
    rationale: m.rationale,
    sourceHash,
  };
  const auditRecords = {
    'verdict.attestation.documentHash': sourceHash,
    'verdict.attestation.issuedAt': String(now),
    'verdict.attestation.expiresAt': String(now + m.validityDays * 86_400),
    'verdict.attestation.status': m.auditStatus,
    'verdict.attestation.ai.model': common.model,
    'verdict.attestation.ai.confidence': common.confidence,
    'verdict.attestation.ai.rationale': common.rationale,
    'verdict.attestation.ai.sourceHash': common.sourceHash,
  };
  const riskRecords = {
    'verdict.observation.observedAt': String(now),
    'verdict.observation.severity': m.severity,
    'verdict.observation.reasonCode': m.reasonCode,
    'verdict.observation.status': m.auditStatus,
    'verdict.observation.ai.model': common.model,
    'verdict.observation.ai.confidence': common.confidence,
    'verdict.observation.ai.rationale': common.rationale,
    'verdict.observation.ai.sourceHash': common.sourceHash,
  };
  const iface = new Interface(RESOLVER_ABI);
  async function prepareRecords(resolver: string, walletName: string, name: string, records: Record<string, string>, worker: string, keys: readonly string[]) {
    assertAllowedRecords(keys, records);
    const wallet = await loadWallet(walletName, provider);
    if (wallet.address.toLowerCase() !== worker.toLowerCase()) throw new Error('Evidence keystore does not match the configured worker.');
    const contract = new Contract(resolver, RESOLVER_ABI, wallet);
    const calls = Object.entries(records).map(([key, value]) =>
      iface.encodeFunctionData('setText', [dnsEncode(name), key, value]));
    await contract.multicall.staticCall(calls);
    return async () => {
      const tx = await contract.multicall(calls);
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) throw new Error(`ENS write reverted: ${tx.hash}`);
      return { hash: String(tx.hash), blockNumber: Number(receipt.blockNumber) };
    };
  }
  const publishAudit = await prepareRecords(
    authorities.auditor.resolver, 'verdict-auditor', authorities.auditor.name, auditRecords, authorities.auditor.worker, AUDITOR_KEYS,
  );
  const publishRisk = await prepareRecords(
    authorities.monitor.resolver, 'verdict-monitor', authorities.monitor.name, riskRecords, authorities.monitor.worker, MONITOR_KEYS,
  );
  const audit = await publishAudit();
  try {
    const risk = await publishRisk();
    return { audit, risk };
  } catch {
    throw new Error(`Partial evidence publication: auditor transaction ${audit.hash} confirmed, sentinel publication failed. No combined summary was published; retry/reconcile explicitly.`);
  }
}

export type QuartetEvent = {
  t: string;
  kind: 'run-start' | 'evidence' | 'inspector-start' | 'inspector-ok' | 'synthesis-start' | 'synthesis-ok' | 'write' | 'done' | 'error';
  label: string;
  detail?: string;
  ms?: number;
};
export type QuartetEmit = (event: Omit<QuartetEvent, 't'>) => void;

export type QuartetOptions = {
  /** Custom auditor subname (e.g. zero-risk.verdict.eth). Policy + owner are re-read live from chain. */
  customPolicySubname?: string;
};

export async function runQuartetStream(subject: string, write: boolean, emit: QuartetEmit, opts: QuartetOptions = {}): Promise<QuartetRun> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const ctx = newRunContext();
  const chainLabel = ctx.chain.map((p) => p.id).join(' → ') || 'none configured';
  const isDemoAsset = subject.toLowerCase() === DEMO_ASSET;

  // Mode B: resolve the custom policy from chain — never trust a client string.
  let customPolicy: { subname: string; owner: string; policy: string } | undefined;
  if (opts.customPolicySubname) {
    const { readAgentBranch } = await import('./factory');
    const subname = opts.customPolicySubname.trim().toLowerCase();
    if (!/^(?=.{1,255}$)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/.test(subname)) {
      throw new Error('Invalid custom auditor subname.');
    }
    const branch = await readAgentBranch(subname);
    if (!branch.policy.trim()) throw new Error(`${subname} has no agent.policy record yet.`);
    customPolicy = { subname, owner: branch.owner, policy: branch.policy.slice(0, 2000) };
    emit({ kind: 'run-start', label: `Mode B · custom auditor ${subname}`, detail: `operator ${branch.owner.slice(0, 10)}… · policy read live from ENS` });
  }
  emit({ kind: 'run-start', label: `Subject ${subject}`, detail: `engines ${chainLabel} · ${isDemoAsset ? 'live ENS evidence' : 'live external evidence'}` });

  const pack = isDemoAsset
    ? await buildDemoAssetEvidence(DEMO_ASSET, (step) =>
        emit({ kind: 'evidence', label: `evidence · ${step.key}`, detail: step.detail, ms: step.ms }))
    : await buildCatalogEvidence(subject, (step) =>
        emit({ kind: 'evidence', label: `evidence · ${step.key}`, detail: step.detail, ms: step.ms }));

  const ids: InspectorId[] = ['legal', 'custody', 'technical'];
  for (const id of ids) emit({ kind: 'inspector-start', label: `inspector → ${id}`, detail: 'running in parallel' });
  const timedInspector = (id: InspectorId) => {
    const t0 = Date.now();
    return runInspector(ctx, id, pack).then(({ report, engine }) => {
      emit({ kind: 'inspector-ok', label: `inspector ✓ ${id}`, detail: `${report.status} · ${report.score}/100 · via ${engine.provider}`, ms: Date.now() - t0 });
      return { id, report, engine };
    });
  };
  const settled = await Promise.all(ids.map(timedInspector));
  const reports = Object.fromEntries(settled.map(({ id, report }) => [id, report])) as Record<InspectorId, InspectorReport>;
  const engines = Object.fromEntries(settled.map(({ id, engine }) => [id, engine])) as QuartetRun['engines'];

  emit({ kind: 'synthesis-start', label: customPolicy ? `synthesizer → consensus + ${customPolicy.subname} lens` : 'synthesizer → consensus', detail: 'weights legal 30 · custody 40 · technical 30' });
  const synthT0 = Date.now();
  const { synthesis, engine: synthEngine } = await runSynthesizer(ctx, pack, reports, customPolicy);
  engines.synthesis = synthEngine;
  emit({
    kind: 'synthesis-ok',
    label: `consensus ✓ ${synthesis.verdict}`,
    detail: `${synthesis.overall_score}/100 → ${synthesis.policy_state} · via ${synthEngine.provider}`,
    ms: Date.now() - synthT0,
  });

  const run: QuartetRun = {
    id: `${started}-${slug(subject)}`,
    subject,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    model: synthEngine.model,
    mode: customPolicy ? 'custom' : 'official',
    customPolicy,
    engines,
    usage: ctx.usage,
    reports,
    synthesis,
    evidenceSummary: {
      contractAddress: pack.contract?.address ?? null,
      contractVerified: pack.verification?.isVerified ?? null,
      marketUsd: pack.market?.usd ?? null,
      issuerReachable: pack.issuerPage?.reachable ?? null,
    },
    write: { requested: write, performed: false, reason: '' },
  };

  if (write && isDemoAsset) {
    try {
      const fingerprint = JSON.stringify({ subject: pack.subject, builtAt: pack.builtAt, reports, synthesis, engines });
      const transactions = await writeDemoAssetDecision(synthesis, fingerprint, synthEngine.model, DEMO_ASSET, run);
      run.write.transactions = transactions;
      run.write.performed = true;
      run.write.reason = 'Four original reports published through separate scoped workers, followed by mapped auditor/monitor evidence.';
      emit({ kind: 'write', label: 'chain write ✓ demo asset', detail: transactions.audit.hash.slice(0, 18) });
    } catch (error) {
      run.write.reason = error instanceof Error ? error.message : 'Onchain write failed';
      emit({ kind: 'write', label: 'chain write × failed', detail: run.write.reason });
    }
  } else if (write && !isDemoAsset) {
    run.write.reason = 'Writes are only enabled for the ENS demo asset; catalog assets are inspect-only.';
    emit({ kind: 'write', label: 'chain write skipped', detail: run.write.reason });
  } else {
    run.write.reason = 'Dry run — no chain writes requested.';
    emit({ kind: 'write', label: 'inspect-only', detail: run.write.reason });
  }

  run.finishedAt = new Date().toISOString();
  run.durationMs = Date.now() - started;
  persist(run);
  emit({ kind: 'done', label: `done in ${Math.round(run.durationMs / 1000)}s`, detail: `${synthesis.verdict} ${synthesis.overall_score}/100 → ${synthesis.policy_state}`, ms: run.durationMs });
  return run;
}

export async function runQuartet(subject: string, write: boolean, opts: QuartetOptions = {}): Promise<QuartetRun> {
  return runQuartetStream(subject, write, () => {}, opts);
}

export function isDemoAssetSubject(subject: string) {
  return subject.toLowerCase() === DEMO_ASSET;
}

const QUARTET_RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
];

/**
 * Publish protected evidence through separate auditor/sentinel workers first,
 * then a convenience summary through the issuer namespace relayer. The summary
 * is explicitly NOT a four-signer attestation or a protected authority record.
 */
export async function writeQuartetSnapshot(marketId: string, synthesis: Synthesis, evidenceFingerprint?: string, engineModel = 'unspecified', quartet?: Pick<QuartetRun, 'reports' | 'synthesis' | 'engines' | 'startedAt'>) {
  if (process.env.VERCEL) throw new Error('Onchain score refresh is disabled on this deployment.');
  const { DEMO_ASSETS } = await import('@/components/app/demo-data');
  const asset = DEMO_ASSETS.find((a) => a.marketId === marketId);
  if (!asset || !asset.name.endsWith('.rwa.verdict.eth')) throw new Error(`Unknown canonical RWA asset: ${marketId}`);
  const fingerprint = evidenceFingerprint || JSON.stringify({ asset: asset.name, synthesis });
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENSV2_SEPOLIA.chainId) throw new Error('Summary RPC must be Sepolia.');
    return await publishQuartetSummary(provider, asset.name, synthesis, fingerprint, engineModel, quartet);
  } finally { provider.destroy(); }
}

async function publishQuartetSummary(provider: JsonRpcProvider, assetName: string, synthesis: Synthesis, fingerprint: string, engineModel: string, quartet?: Pick<QuartetRun, 'reports' | 'synthesis' | 'engines' | 'startedAt'>) {
  const { namespaceWallet } = await import('./factory');
  const wallet = await namespaceWallet(provider);
  if (wallet.address.toLowerCase() !== ENSV2_SEPOLIA.actors.namespaceOperator.toLowerCase()) throw new Error('Summary relayer does not match the namespace operator.');
  if ((await provider.getBalance(wallet.address)) === BigInt(0)) throw new Error('Summary relayer needs Sepolia ETH.');
  const authorities = evidenceAuthorities(assetName);
  const evidenceTransactions = await writeDemoAssetDecision(synthesis, fingerprint, engineModel, assetName, quartet);
  const now = Math.floor(Date.now() / 1000);
  const sourceHash = keccak256(toUtf8Bytes(fingerprint));
  const records = {
    'verdict.quartet.score': String(synthesis.overall_score),
    'verdict.quartet.status': synthesis.verdict,
    'verdict.quartet.policy': synthesis.policy_state,
    'verdict.quartet.reason': synthesis.mapped.reasonCode,
    'verdict.quartet.summary': synthesis.reasoning_summary.slice(0, 280),
    'verdict.quartet.runAt': String(now),
    'verdict.quartet.validity': String(synthesis.mapped.validityDays),
    'verdict.quartet.sourceHash': sourceHash,
    'verdict.quartet.publicationMode': 'offchain-ai-single-relayer-summary',
    'verdict.asset.attestation': authorities.auditor.name,
    'verdict.asset.observation': authorities.monitor.name,
    'verdict.quartet.auditTx': evidenceTransactions.audit.hash,
    'verdict.quartet.observationTx': evidenceTransactions.risk.hash,
    'verdict.quartet.legalTx': evidenceTransactions.agents.legal.hash,
    'verdict.quartet.custodyTx': evidenceTransactions.agents.custody.hash,
    'verdict.quartet.technicalTx': evidenceTransactions.agents.technical.hash,
    'verdict.quartet.consensusTx': evidenceTransactions.agents.consensus.hash,
    'verdict.quartet.workerPublicationMode': 'four-team-operated-scoped-workers',
  };
  const contract = new Contract(ENSV2_SEPOLIA.proxies.namespaceResolver, QUARTET_RESOLVER_ABI, wallet);
  const iface = new Interface(QUARTET_RESOLVER_ABI);
  const encoded = dnsEncode(assetName);
  const calls = Object.entries(records).map(([key, value]) =>
    iface.encodeFunctionData('setText', [encoded, key, value]));
  await contract.multicall.staticCall(calls);
  const tx = await contract.multicall(calls);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) throw new Error(`Quartet snapshot reverted: ${tx.hash}`);
  return { hash: String(tx.hash), blockNumber: Number(receipt.blockNumber), sourceHash, evidenceTransactions };
}
