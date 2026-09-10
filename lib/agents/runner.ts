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

function geminiConfig() {
  const file = loadEnvFile();
  const apiKey = process.env.GEMINI_API_KEY || file.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  return { apiKey, model: process.env.GEMINI_MODEL || file.GEMINI_MODEL || 'gemini-3.6-flash' };
}

function extractJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(system: string, user: string, timeoutMs: number): Promise<unknown> {
  const { apiKey, model } = geminiConfig();
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { role: 'system', parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
          signal: controller.signal,
        },
      );
      if (response.status === 503 || response.status === 429 || (response.status >= 500 && response.status < 600)) {
        lastError = new Error(`Gemini request failed (${response.status})`);
      } else {
        if (!response.ok) throw new Error(`Gemini request failed (${response.status})`);
        const body = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        if (!text) throw new Error('Gemini returned no content');
        return extractJson(text);
      }
    } catch (error) {
      // Network-level failures (flaky egress) are retried; API 4xx and
      // validation-shaped errors throw immediately above.
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < 3) await sleep(attempt === 1 ? 4000 : 10000);
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

async function runInspector(id: InspectorId, pack: EvidencePack): Promise<InspectorReport> {
  const raw = await callGemini(promptFor(id), userMessage(pack), 90_000);
  return validateInspectorReport(id, raw);
}

async function runSynthesizer(pack: EvidencePack, reports: Record<InspectorId, InspectorReport>): Promise<Synthesis> {
  const input = `EVIDENCE PACK:\n${JSON.stringify(pack)}\n\nINSPECTOR REPORTS:\n${JSON.stringify(reports)}`;
  const raw = await callGemini(SYNTHESIZER_PROMPT, input, 90_000);
  return validateSynthesis(raw);
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
async function writeDemoAssetDecision(synthesis: Synthesis, evidenceFingerprint: string) {
  const file = loadEnvFile();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || file.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  const provider = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
  const now = Math.floor(Date.now() / 1000);
  const m = synthesis.mapped;
  // Content-bound fingerprint of the evidence + reports behind this decision.
  const sourceHash = keccak256(toUtf8Bytes(evidenceFingerprint));
  const common = {
    model: geminiConfig().model,
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

export async function runQuartet(subject: string, write: boolean): Promise<QuartetRun> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const isDemoAsset = subject.toLowerCase() === DEMO_ASSET;
  const pack = isDemoAsset ? await buildDemoAssetEvidence(DEMO_ASSET) : await buildCatalogEvidence(subject);
  const { model } = geminiConfig();

  const [legal, custody, technical] = await Promise.all([
    runInspector('legal', pack),
    runInspector('custody', pack),
    runInspector('technical', pack),
  ]);
  const reports = { legal, custody, technical };
  const synthesis = await runSynthesizer(pack, reports);

  const run: QuartetRun = {
    id: `${started}-${slug(subject)}`,
    subject,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    model,
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
      run.write.transactions = await writeDemoAssetDecision(synthesis, fingerprint);
      run.write.performed = true;
      run.write.reason = 'Mapped decision written through scoped auditor/monitor wallets.';
    } catch (error) {
      run.write.reason = error instanceof Error ? error.message : 'Onchain write failed';
    }
  } else if (write && !isDemoAsset) {
    run.write.reason = 'Writes are only enabled for the ENS demo asset; catalog assets are inspect-only.';
  } else {
    run.write.reason = 'Dry run — no chain writes requested.';
  }

  run.finishedAt = new Date().toISOString();
  run.durationMs = Date.now() - started;
  persist(run);
  return run;
}

export function isDemoAssetSubject(subject: string) {
  return subject.toLowerCase() === DEMO_ASSET;
}
