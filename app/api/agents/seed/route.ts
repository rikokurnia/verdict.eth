import { mkdirSync, readdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { Contract, Interface, JsonRpcProvider, dnsEncode, namehash } from 'ethers';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { runQuartet, writeQuartetSnapshot } from '@/lib/agents/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const textInterface = new Interface(TEXT_ABI);

const SEED_DIR = join(process.cwd(), '.secrets', 'seed-runs');

const CATALOG = DEMO_ASSETS.filter((a) => a.marketId && a.coverage === 'CONSENSUS_SCORED').map((a) => ({
  marketId: a.marketId as string,
  name: a.name,
  ticker: a.ticker,
}));

function rpc() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured');
  return new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
}

/** Cheapest possible staleness check: one UR read of verdict.quartet.runAt. */
async function readRunAt(universal: Contract, name: string, blockTag: number): Promise<number | null> {
  try {
    const query = textInterface.encodeFunctionData('text', [namehash(name), 'verdict.quartet.runAt']);
    const [raw] = await universal.resolve(dnsEncode(name), query, { blockTag });
    const [value] = textInterface.decodeFunctionResult('text', raw);
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persistReceipt(receipt: unknown) {
  try {
    mkdirSync(SEED_DIR, { recursive: true, mode: 0o700 });
    const path = join(SEED_DIR, `${Date.now()}.json`);
    writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    chmodSync(path, 0o600);
  } catch { /* receipts are best-effort */ }
}

export function readSeedReceipts(limit = 5) {
  try {
    return readdirSync(SEED_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((file) => {
        const raw = readFileSync(join(SEED_DIR, file), 'utf8');
        return { file, receipt: JSON.parse(raw) as unknown };
      });
  } catch {
    return [];
  }
}

/**
 * Curator bulk refresh. Processes up to `limit` stale assets per call —
 * clients loop with offset until done. Each scored asset gets its quartet
 * snapshot written to its rwa profile name.
 */
export async function POST(request: Request) {
  let body: { limit?: number; offset?: number; onlyStale?: boolean; maxAgeDays?: number; marketIds?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const limit = Math.min(Math.max(body.limit ?? 5, 1), 20);
  const offset = Math.max(body.offset ?? 0, 0);
  const onlyStale = body.onlyStale !== false;
  const maxAge = (body.maxAgeDays ?? 7) * 86_400;
  const targeted = Array.isArray(body.marketIds) && body.marketIds.length > 0
    ? CATALOG.filter((a) => (body.marketIds as string[]).includes(a.marketId))
    : null;
  if (targeted && targeted.length === 0) {
    return NextResponse.json({ error: 'No matching catalog assets.' }, { status: 400 });
  }

  const provider = rpc();
  const sourceBlock = await provider.getBlockNumber();
  const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, provider);
  const now = Math.floor(Date.now() / 1000);

  const runAts = await Promise.all(CATALOG.map((a) => readRunAt(universal, a.name, sourceBlock)));
  const scoredAt = new Map(CATALOG.map((a, i) => [a.marketId, runAts[i]]));
  const base = targeted ?? CATALOG.slice(offset);
  const queue = targeted ?? base.filter((a) => {
    if (!onlyStale) return true;
    const at = scoredAt.get(a.marketId) ?? null;
    return at === null || now - at > maxAge;
  });

  const results: Record<string, unknown>[] = [];
  for (const asset of queue.slice(0, limit)) {
    try {
      const run = await runQuartet(asset.marketId, false);
      const tx = await writeQuartetSnapshot(asset.marketId, run.synthesis);
      results.push({
        marketId: asset.marketId,
        name: asset.name,
        action: 'scored',
        verdict: run.synthesis.verdict,
        score: run.synthesis.overall_score,
        policy: run.synthesis.policy_state,
        transaction: tx,
      });
    } catch (error) {
      results.push({ marketId: asset.marketId, name: asset.name, action: 'failed', error: error instanceof Error ? error.message : 'unknown' });
    }
  }

  const receipt = {
    startedAt: new Date().toISOString(),
    offset,
    limit,
    onlyStale,
    results,
    remaining: Math.max(queue.length - limit, 0),
    done: offset + limit >= CATALOG.length || queue.length <= limit,
  };
  persistReceipt(receipt);
  return NextResponse.json({ ok: true, receipt }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Latest bulk-refresh receipts (transparency log). */
export async function GET() {
  return NextResponse.json({ ok: true, receipts: readSeedReceipts() }, { headers: { 'Cache-Control': 'no-store' } });
}
