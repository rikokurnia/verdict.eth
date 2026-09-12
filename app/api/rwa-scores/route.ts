import { NextResponse } from 'next/server';
import { Contract, Interface, JsonRpcProvider, dnsEncode, namehash } from 'ethers';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

export const dynamic = 'force-dynamic';

const TEXT_ABI = ['function text(bytes32 node,string key) view returns (string)'];
const UNIVERSAL_ABI = ['function resolve(bytes name,bytes data) view returns (bytes result,address resolver)'];
const textInterface = new Interface(TEXT_ABI);

const KEYS = [
  'verdict.quartet.score',
  'verdict.quartet.status',
  'verdict.quartet.policy',
  'verdict.quartet.reason',
  'verdict.quartet.summary',
  'verdict.quartet.runAt',
  'verdict.quartet.validity',
  'verdict.quartet.sourceHash',
] as const;

export type RwaScore = {
  score: number | null;
  status: string;
  policy: string;
  reason: string;
  summary: string;
  runAt: number | null;
  validityDays: number | null;
  sourceHash: string;
};

const CATALOG = DEMO_ASSETS.filter((a) => a.marketId && a.coverage === 'CONSENSUS_SCORED').map((a) => ({ marketId: a.marketId as string, name: a.name }));

let cache: { at: number; payload: unknown } | null = null;
const TTL_MS = 5 * 60_000;

async function readScore(universal: Contract, name: string, blockTag: number): Promise<RwaScore> {
  const rows = await Promise.all(
    KEYS.map(async (key) => {
      try {
        const query = textInterface.encodeFunctionData('text', [namehash(name), key]);
        const [raw] = await universal.resolve(dnsEncode(name), query, { blockTag });
        const [value] = textInterface.decodeFunctionResult('text', raw);
        return String(value);
      } catch {
        return '';
      }
    }),
  );
  const [score, status, policy, reason, summary, runAt, validity, sourceHash] = rows;
  const parsedScore = Number(score);
  const parsedRunAt = Number(runAt);
  const parsedValidity = Number(validity);
  return {
    score: Number.isFinite(parsedScore) && score !== '' ? parsedScore : null,
    status,
    policy,
    reason,
    summary,
    runAt: Number.isFinite(parsedRunAt) && runAt !== '' ? parsedRunAt : null,
    validityDays: Number.isFinite(parsedValidity) && validity !== '' ? parsedValidity : null,
    sourceHash,
  };
}

/** All 20 onchain quartet snapshots in one call (memory-cached 5 min). */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload, { headers: { 'Cache-Control': 'no-store' } });
  }
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) return NextResponse.json({ error: 'SEPOLIA_RPC_URL is not configured.' }, { status: 500 });
  try {
    const rpc = new JsonRpcProvider(rpcUrl, ENSV2_SEPOLIA.chainId, { staticNetwork: true });
    const sourceBlock = await rpc.getBlockNumber();
    const universal = new Contract(ENSV2_SEPOLIA.contracts.universalResolver, UNIVERSAL_ABI, rpc);
    const scores: Record<string, RwaScore> = {};
    for (const asset of CATALOG) {
      scores[asset.marketId] = await readScore(universal, asset.name, sourceBlock);
    }
    const payload = { ok: true, sourceBlock, fetchedAt: new Date().toISOString(), scores };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('RWA scores read failed', error);
    return NextResponse.json({ ok: false, scores: {} }, { status: 502 });
  }
}
