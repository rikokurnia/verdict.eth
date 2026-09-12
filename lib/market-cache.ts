import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type CachedQuotes = Record<string, { usd: number; change24h: number | null; updatedAt: number | null; image?: string }>;

const DIR = process.env.VERCEL ? join('/tmp', 'verdict-market-cache') : join(process.cwd(), '.cache');
const FILE = join(DIR, 'market-last-good.json');

/** Last successful CoinGecko response, so a rate-limit never blanks the dashboard. */
export function readLastGood(): { quotes: CachedQuotes; savedAt: string } | null {
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { quotes?: CachedQuotes; savedAt?: string };
    if (!parsed.quotes || typeof parsed.quotes !== 'object' || Object.keys(parsed.quotes).length === 0) return null;
    return { quotes: parsed.quotes, savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : 'unknown' };
  } catch {
    return null;
  }
}

export function writeLastGood(quotes: CachedQuotes) {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify({ quotes, savedAt: new Date().toISOString() }), { mode: 0o600 });
  } catch {
    /* Cache is best-effort (e.g. read-only serverless runtimes). */
  }
}
