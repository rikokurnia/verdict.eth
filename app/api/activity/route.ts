import { NextResponse } from 'next/server';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

export const dynamic = 'force-dynamic';

const WATCHED: { label: string; address: string }[] = [
  { label: 'Namespace resolver', address: ENSV2_SEPOLIA.proxies.namespaceResolver },
  { label: 'Auditor resolver', address: ENSV2_SEPOLIA.proxies.auditorResolver },
  { label: 'Monitor resolver', address: ENSV2_SEPOLIA.proxies.monitorResolver },
  { label: 'Verdict registry', address: ENSV2_SEPOLIA.proxies.verdictRegistry },
  { label: 'Acme registry', address: ENSV2_SEPOLIA.proxies.acmeRegistry },
  { label: 'Auditor registry', address: ENSV2_SEPOLIA.proxies.auditorRegistry },
  { label: 'Monitor registry', address: ENSV2_SEPOLIA.proxies.monitorRegistry },
  { label: 'RWA registry', address: ENSV2_SEPOLIA.proxies.rwaRegistry },
];

const KNOWN_SELECTORS: Record<string, string> = {
  '0xac9650d8': 'multicall (records)',
};

function prettyMethod(raw: string) {
  const selector = raw.slice(0, 10).toLowerCase();
  return KNOWN_SELECTORS[selector] ?? raw.slice(0, 42);
}

export type ActivityTx = {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  method: string;
  contract: string;
  address: string;
};

let cache: { at: number; payload: unknown } | null = null;
const TTL_MS = 90_000;

async function fetchTxs(label: string, address: string): Promise<ActivityTx[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `${ENSV2_SEPOLIA.explorer}/api/v2/addresses/${address}/transactions`,
      { headers: { accept: 'application/json' }, signal: controller.signal },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as {
      items?: { hash?: string; block_number?: number; timestamp?: string; from?: { hash?: string }; method?: string }[];
    };
    return (body.items ?? []).map((tx) => ({
      hash: String(tx.hash ?? ''),
      blockNumber: Number(tx.block_number ?? 0),
      timestamp: String(tx.timestamp ?? ''),
      from: String(tx.from?.hash ?? ''),
      method: prettyMethod(String(tx.method ?? 'call')),
      contract: label,
      address,
    })).filter((tx) => tx.hash);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Live Sepolia activity across all Verdict contracts (cached 90s). */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.payload, { headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const groups = await Promise.all(WATCHED.map((w) => fetchTxs(w.label, w.address)));
    const seen = new Set<string>();
    const transactions = groups
      .flat()
      .filter((tx) => (seen.has(tx.hash) ? false : (seen.add(tx.hash), true)))
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, 15);
    const payload = { ok: true, transactions, explorer: ENSV2_SEPOLIA.explorer };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Activity feed failed', error);
    return NextResponse.json({ ok: false, transactions: [] }, { status: 502 });
  }
}
