import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { Contract, Interface, JsonRpcProvider, Wallet, dnsEncode, keccak256, toUtf8Bytes } from 'ethers';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
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
const RUNS_DIR = join(process.cwd(), '.secrets', 'agent-runs');

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
  mkdirSync(RUNS_DIR, { recursive: true, mode: 0o700 });
  const path = join(RUNS_DIR, `${Date.now()}-${slug(run.subject)}.json`);
  writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
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
 * Writes the synthesizer-mapped decision into the demo asset's existing
 * scoped record keys. Only ever runs for the ENS demo asset, through the
 * auditor/monitor wallets, inside their EAC text-record allowance.
 */
async function writeDemoAssetDecision(synthesis: Synthesis, evidenceFingerprint: string, engineModel: string) {
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const provider = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
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
  async function writeRecords(resolver: string, walletName: string, name: string, records: Record<string, string>) {
    const wallet = await loadWallet(walletName, provider);
    const contract = new Contract(resolver, RESOLVER_ABI, wallet);
    const calls = Object.entries(records).map(([key, value]) =>
      iface.encodeFunctionData('setText', [dnsEncode(name), key, value]));
    await contract.multicall.staticCall(calls);
    const tx = await contract.multicall(calls);
    const receipt = await tx.wait(1);
    if (receipt.status !== 1) throw new Error(`ENS write reverted: ${tx.hash}`);
    return { hash: String(tx.hash), blockNumber: Number(receipt.blockNumber) };
  }
  const audit = await writeRecords(
    ENSV2_SEPOLIA.proxies.auditorResolver, 'verdict-auditor', ENSV2_SEPOLIA.names.audit, auditRecords,
  );
  const risk = await writeRecords(
    ENSV2_SEPOLIA.proxies.monitorResolver, 'verdict-monitor', ENSV2_SEPOLIA.names.observation, riskRecords,
  );
  return { audit, risk };
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
      const fingerprint = JSON.stringify({ subject: pack.subject, builtAt: pack.builtAt, reports });
      const transactions = await writeDemoAssetDecision(synthesis, fingerprint, synthEngine.model);
      run.write.transactions = transactions;
      run.write.performed = true;
      run.write.reason = 'Mapped decision written through scoped auditor/monitor wallets.';
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
 * Writes the consensus snapshot to the asset's Verdict registry profile
 * (<label>.rwa.verdict.eth). Namespace owns all profile names and holds root
 * roles on the rwa registry, so no new permissions are needed. Identity
 * records are never touched — only verdict.quartet.* keys.
 */
export async function writeQuartetSnapshot(marketId: string, synthesis: Synthesis) {
  const { DEMO_ASSETS } = await import('@/components/app/demo-data');
  const asset = DEMO_ASSETS.find((a) => a.marketId === marketId);
  if (!asset) throw new Error(`Unknown catalog asset: ${marketId}`);
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const provider = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
  const { namespaceWallet } = await import('./factory');
  const wallet = await namespaceWallet(provider);
  const now = Math.floor(Date.now() / 1000);
  const sourceHash = keccak256(toUtf8Bytes(JSON.stringify(synthesis.mapped)));
  const records = {
    'verdict.quartet.score': String(synthesis.overall_score),
    'verdict.quartet.status': synthesis.verdict,
    'verdict.quartet.policy': synthesis.policy_state,
    'verdict.quartet.reason': synthesis.mapped.reasonCode,
    'verdict.quartet.summary': synthesis.reasoning_summary.slice(0, 280),
    'verdict.quartet.runAt': String(now),
    'verdict.quartet.validity': String(synthesis.mapped.validityDays),
    'verdict.quartet.sourceHash': sourceHash,
  };
  const contract = new Contract(ENSV2_SEPOLIA.proxies.namespaceResolver, QUARTET_RESOLVER_ABI, wallet);
  const iface = new Interface(QUARTET_RESOLVER_ABI);
  const encoded = dnsEncode(asset.name);
  const calls = Object.entries(records).map(([key, value]) =>
    iface.encodeFunctionData('setText', [encoded, key, value]));
  await contract.multicall.staticCall(calls);
  const tx = await contract.multicall(calls);
  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error(`Quartet snapshot reverted: ${tx.hash}`);
  return { hash: String(tx.hash), blockNumber: Number(receipt.blockNumber), sourceHash };
}
