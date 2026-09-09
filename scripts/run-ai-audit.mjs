import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  dnsEncode,
  keccak256,
  namehash,
  toUtf8Bytes,
} from 'ethers';

const ROOT = process.cwd();
const CHAIN_ID = 11155111;
const UNIVERSAL_RESOLVER = '0xd26f2040d083af1cd2962ba303f4bea0c4faf142';
const NAMES = {
  asset: 'usd-yield-001.acme.verdict.eth',
  audit: 'audit-001.verdict-auditor.eth',
  risk: 'risk-001.verdict-monitor.eth',
};
const RESOLVERS = {
  audit: '0x1C6e26A8f56C8B6C9286Fe217851c1FC9e7dA6e6',
  risk: '0x6592566d7185bbf811D2508683e4a545297A7C13',
};
const RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const ALLOWED_SEVERITIES = new Set(['info', 'warning', 'high', 'critical']);
const ALLOWED_STATUSES = new Set(['active', 'revoked']);

function loadEnv(path) {
  const output = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) output[line.slice(0, at)] = line.slice(at + 1).replace(/^['"]|['"]$/g, '');
  }
  return output;
}

async function loadWallet(name, provider) {
  const encrypted = readFileSync(join(ROOT, '.secrets', name), 'utf8');
  const password = readFileSync(join(ROOT, '.secrets', `${name}.password`), 'utf8').trim();
  return (await Wallet.fromEncryptedJson(encrypted, password)).connect(provider);
}

async function resolveText(provider, name, key) {
  const text = new Interface(TEXT_ABI);
  const resolver = new Contract(UNIVERSAL_RESOLVER, UNIVERSAL_ABI, provider);
  const query = text.encodeFunctionData('text', [namehash(name), key]);
  const [raw] = await resolver.resolve(dnsEncode(name), query);
  return String(text.decodeFunctionResult('text', raw)[0]);
}

function extractJson(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(clean);
}

function validateDecision(value) {
  if (!value || typeof value !== 'object') throw new Error('Gemini returned no decision object');
  if (!ALLOWED_STATUSES.has(value.auditStatus)) throw new Error('Invalid auditStatus from Gemini');
  if (!ALLOWED_SEVERITIES.has(value.severity)) throw new Error('Invalid severity from Gemini');
  if (!/^[A-Z][A-Z0-9_]{2,39}$/.test(value.reasonCode)) throw new Error('Invalid reasonCode from Gemini');
  if (!Number.isInteger(value.confidence) || value.confidence < 0 || value.confidence > 95) {
    throw new Error('Invalid confidence from Gemini');
  }
  if (!Number.isInteger(value.validityDays) || value.validityDays < 1 || value.validityDays > 90) {
    throw new Error('Invalid validityDays from Gemini');
  }
  if (typeof value.rationale !== 'string' || value.rationale.length < 10 || value.rationale.length > 280) {
    throw new Error('Invalid rationale from Gemini');
  }
  return value;
}

async function analyzeWithGemini(apiKey, model, source, sourceHash) {
  const schema = {
    type: 'OBJECT',
    properties: {
      auditStatus: { type: 'STRING', enum: ['active', 'revoked'] },
      severity: { type: 'STRING', enum: ['info', 'warning', 'high', 'critical'] },
      reasonCode: { type: 'STRING', description: 'Uppercase machine code, maximum 40 characters.' },
      confidence: { type: 'INTEGER', minimum: 0, maximum: 95 },
      validityDays: { type: 'INTEGER', minimum: 1, maximum: 90 },
      rationale: { type: 'STRING', description: 'Evidence-grounded summary under 280 characters.' },
    },
    required: ['auditStatus', 'severity', 'reasonCode', 'confidence', 'validityDays', 'rationale'],
  };
  const prompt = [
    'You are Verdict, an evidence auditor for a fictional Sepolia hackathon demonstration.',
    `The only permitted subject is ${NAMES.asset}.`,
    'Assess only the supplied evidence. Do not invent facts. Missing, stale, contradictory, or material adverse evidence must increase severity.',
    'Use auditStatus=active only when subject binding, document completeness, and reserve coverage are supported with no material exception.',
    'Use a concise uppercase reasonCode and a short factual rationale. This is evidence classification, not investment advice.',
    `Locally computed immutable source hash: ${sourceHash}`,
    `Evidence:\n${source}`,
  ].join('\n\n');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: schema },
      }),
    },
  );
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`Gemini request failed (${response.status}): ${body}`);
  }
  const body = await response.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('Gemini returned no structured content');
  return validateDecision(extractJson(text));
}

async function writeRecords(resolverAddress, wallet, name, records) {
  const contract = new Contract(resolverAddress, RESOLVER_ABI, wallet);
  const iface = new Interface(RESOLVER_ABI);
  const encodedName = dnsEncode(name);
  const calls = Object.entries(records).map(([key, value]) =>
    iface.encodeFunctionData('setText', [encodedName, key, String(value)]));
  await contract.multicall.staticCall(calls);
  const tx = await contract.multicall(calls);
  const receipt = await tx.wait(1);
  if (receipt.status !== 1) throw new Error(`ENS write reverted: ${tx.hash}`);
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
}

async function main() {
  const env = loadEnv(join(ROOT, '.env.local'));
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing from .env.local');
  if (!env.SEPOLIA_RPC_URL) throw new Error('SEPOLIA_RPC_URL is missing from .env.local');
  const write = process.argv.includes('--write');
  const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
  const sourcePath = resolve(ROOT, sourceArg?.slice('--source='.length) || 'evidence/usd-yield-001.json');
  if (!sourcePath.startsWith(`${ROOT}/`)) throw new Error('Evidence source must be inside the project');
  const source = readFileSync(sourcePath, 'utf8');
  const parsedSource = JSON.parse(source);
  if (parsedSource.subject !== NAMES.asset) throw new Error('Evidence subject does not match the configured asset');

  const provider = new JsonRpcProvider(env.SEPOLIA_RPC_URL, CHAIN_ID, { staticNetwork: true });
  if (Number((await provider.getNetwork()).chainId) !== CHAIN_ID) throw new Error('RPC is not Sepolia');
  const [auditSubject, riskSubject] = await Promise.all([
    resolveText(provider, NAMES.audit, 'verdict.subject'),
    resolveText(provider, NAMES.risk, 'verdict.subject'),
  ]);
  if (auditSubject !== NAMES.asset || riskSubject !== NAMES.asset) throw new Error('Onchain evidence subject binding failed');

  const sourceHash = keccak256(toUtf8Bytes(source));
  const model = env.GEMINI_MODEL || 'gemini-3.6-flash';
  const decision = await analyzeWithGemini(env.GEMINI_API_KEY, model, source, sourceHash);
  const now = Math.floor(Date.now() / 1000);
  const common = {
    model,
    confidence: String(decision.confidence),
    rationale: decision.rationale,
    sourceHash,
    evidenceFile: basename(sourcePath),
  };
  const auditRecords = {
    'verdict.attestation.documentHash': sourceHash,
    'verdict.attestation.issuedAt': String(now),
    'verdict.attestation.expiresAt': String(now + decision.validityDays * 86_400),
    'verdict.attestation.status': decision.auditStatus,
    'verdict.attestation.ai.model': common.model,
    'verdict.attestation.ai.confidence': common.confidence,
    'verdict.attestation.ai.rationale': common.rationale,
    'verdict.attestation.ai.sourceHash': common.sourceHash,
  };
  const riskRecords = {
    'verdict.observation.observedAt': String(now),
    'verdict.observation.severity': decision.severity,
    'verdict.observation.reasonCode': decision.reasonCode,
    'verdict.observation.status': decision.auditStatus,
    'verdict.observation.ai.model': common.model,
    'verdict.observation.ai.confidence': common.confidence,
    'verdict.observation.ai.rationale': common.rationale,
    'verdict.observation.ai.sourceHash': common.sourceHash,
  };
  const report = {
    mode: write ? 'write' : 'dry-run',
    chainId: CHAIN_ID,
    subject: NAMES.asset,
    evidenceFile: common.evidenceFile,
    decision,
    sourceHash,
    writes: { audit: auditRecords, risk: riskRecords },
  };

  if (write) {
    const auditor = await loadWallet('verdict-auditor', provider);
    const monitor = await loadWallet('verdict-monitor', provider);
    report.transactions = {
      audit: await writeRecords(RESOLVERS.audit, auditor, NAMES.audit, auditRecords),
      risk: await writeRecords(RESOLVERS.risk, monitor, NAMES.risk, riskRecords),
    };
    const reportPath = join(ROOT, '.secrets', 'last-ai-audit.json');
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    chmodSync(reportPath, 0o600);
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
