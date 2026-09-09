import { statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { Contract, Interface, JsonRpcProvider, dnsEncode, namehash } from 'ethers';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

export const dynamic = 'force-dynamic';

const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const textInterface = new Interface(TEXT_ABI);

// ENSIP-26 discovery keys plus the schema marker this project uses.
const AGENT_KEYS = ['verdict.schema', 'agent-context', 'agent-endpoint[mcp]', 'agent-endpoint'] as const;

type LoopReport = {
  available: boolean;
  mode?: string;
  chainId?: number;
  subject?: string;
  evidenceFile?: string;
  decision?: {
    auditStatus?: string;
    severity?: string;
    reasonCode?: string;
    confidence?: number;
    validityDays?: number;
    rationale?: string;
  };
  sourceHash?: string;
  model?: string;
  transactions?: {
    audit?: { hash?: string; blockNumber?: number };
    risk?: { hash?: string; blockNumber?: number };
  };
  recordedAt?: string;
};

async function readLoopReport(): Promise<LoopReport> {
  try {
    const path = join(process.cwd(), '.secrets', 'last-ai-audit.json');
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const decision = (parsed.decision ?? {}) as LoopReport['decision'];
    const transactions = (parsed.transactions ?? {}) as LoopReport['transactions'];
    const { mtime } = statSync(path);
    return {
      available: true,
      mode: typeof parsed.mode === 'string' ? parsed.mode : undefined,
      chainId: typeof parsed.chainId === 'number' ? parsed.chainId : undefined,
      subject: typeof parsed.subject === 'string' ? parsed.subject : undefined,
      evidenceFile: typeof parsed.evidenceFile === 'string' ? parsed.evidenceFile : undefined,
      decision,
      sourceHash: typeof parsed.sourceHash === 'string' ? parsed.sourceHash : undefined,
      transactions,
      recordedAt: mtime.toISOString(),
    };
  } catch {
    return { available: false };
  }
}

export async function GET() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    return NextResponse.json({ error: 'SEPOLIA_RPC_URL is not configured.' }, { status: 500 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const rpc = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
    const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, rpc);
    const name = ENSV2_SEPOLIA.names.agent;
    const node = namehash(name);
    const encoded = dnsEncode(name);
    const records: Record<string, string> = {};
    let resolver = '';
    for (const key of AGENT_KEYS) {
      const query = textInterface.encodeFunctionData('text', [node, key]);
      const [raw, answerResolver] = await universal.resolve(encoded, query);
      const [value] = textInterface.decodeFunctionResult('text', raw);
      records[key] = String(value);
      resolver = String(answerResolver);
    }
    const loop = await readLoopReport();
    const model = await readLoopModel();
    return NextResponse.json(
      {
        ok: true,
        chainId: ENSV2_SEPOLIA.chainId,
        agent: {
          name,
          resolver,
          schema: records['verdict.schema'],
          context: records['agent-context'],
          endpoints: { mcp: records['agent-endpoint[mcp]'], default: records['agent-endpoint'] },
          bound: { context: records['agent-context'].length > 0, mcp: records['agent-endpoint[mcp]'].length > 0 },
          // Honest ENSIP-25 line: this deployment asserts the name by operator
          // attestation; no onchain agent-registry binding is claimed.
          registryBinding: 'none-claimed',
        },
        loop: { ...loop, model },
        explorer: ENSV2_SEPOLIA.explorer,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Agent identity resolution failed', error);
    return NextResponse.json({ ok: false, error: 'Agent records unavailable. Retry when connectivity returns.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

async function readLoopModel(): Promise<string | undefined> {
  try {
    const raw = await readFile(join(process.cwd(), '.secrets', 'last-ai-audit.json'), 'utf8');
    const parsed = JSON.parse(raw) as { writes?: { audit?: Record<string, string> } };
    return parsed.writes?.audit?.['verdict.attestation.ai.model'];
  } catch {
    return undefined;
  }
}
