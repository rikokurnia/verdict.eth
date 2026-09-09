import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const IDS = [
  'blackrock-usd-institutional-digital-liquidity-fund',
  'hashnote-usyc',
  'ondo-us-dollar-yield',
  'ousg',
  'franklin-templeton-benji',
  'superstate-short-duration-us-government-securities-fund-ustb',
  'janus-henderson-anemoy-treasury-fund',
  'eutbl',
  'spiko-amundi-overnight-swap-fund-eur',
  'janus-henderson-anemoy-aaa-clo-fund',
  'ylds',
  'tether-gold',
  'pax-gold',
  'kinesis-gold',
  'nvidia-xstock',
  'tesla-xstock',
  'syrup',
  'figure-heloc',
  'blockchain-capital',
  'onyc',
  'bitcoin',
  'ethereum',
];

type MarketRow = {
  id: string;
  image?: string;
  current_price?: number;
  price_change_percentage_24h?: number | null;
  last_updated?: string;
};
type SimpleRow = { usd?: number; usd_24h_change?: number; last_updated_at?: number };

function unixFromIso(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

async function fetchMarkets(signal: AbortSignal) {
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('ids', IDS.join(','));
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', String(IDS.length));
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');
  url.searchParams.set('price_change_percentage', '24h');
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal, next: { revalidate: 120 } });
  if (!response.ok) throw new Error(`Market source returned ${response.status}`);
  const rows = await response.json() as MarketRow[];
  return Object.fromEntries(rows.flatMap((row) => {
    if (!row.id || typeof row.current_price !== 'number') return [];
    return [[row.id, {
      usd: row.current_price,
      change24h: typeof row.price_change_percentage_24h === 'number' ? row.price_change_percentage_24h : null,
      updatedAt: unixFromIso(row.last_updated),
      image: typeof row.image === 'string' ? row.image : undefined,
    }]];
  }));
}

async function fetchSimpleFallback(signal: AbortSignal) {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', IDS.join(','));
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');
  url.searchParams.set('include_last_updated_at', 'true');
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal, next: { revalidate: 120 } });
  if (!response.ok) throw new Error(`Market fallback returned ${response.status}`);
  const raw = await response.json() as Record<string, SimpleRow>;
  return Object.fromEntries(IDS.flatMap((id) => {
    const row = raw[id];
    if (!row || typeof row.usd !== 'number') return [];
    return [[id, {
      usd: row.usd,
      change24h: typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null,
      updatedAt: typeof row.last_updated_at === 'number' ? row.last_updated_at : null,
    }]];
  }));
}

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    try {
      const quotes = await fetchMarkets(controller.signal);
      return NextResponse.json({ ok: true, source: 'CoinGecko', quotes }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
    } catch (marketsError) {
      console.warn('Market markets feed failed, trying simple price fallback', marketsError);
      const quotes = await fetchSimpleFallback(controller.signal);
      return NextResponse.json({ ok: true, source: 'CoinGecko', quotes }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
    }
  } catch (error) {
    console.error('Market data fetch failed', error);
    return NextResponse.json({ ok: false, source: 'CoinGecko', quotes: {} }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
