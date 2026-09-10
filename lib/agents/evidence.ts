import { DEMO_ASSETS } from '@/components/app/demo-data';
import { curatedFacts } from './registry';
import { resolveVerdict } from '@/lib/verdict-service';
import type { EvidencePack } from './types';

const CG = 'https://api.coingecko.com/api/v3';
const BLOCKSCOUT = 'https://eth.blockscout.com/api/v2';

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextHead(url: string, timeoutMs: number): Promise<{ reachable: boolean; title: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept: 'text/html', 'user-agent': 'VerdictEvidenceBot/1.0 (+verdict demo)' },
      signal: controller.signal,
    });
    if (!response.ok) return { reachable: false, title: null };
    const html = await response.text();
    const title = html.slice(0, 60_000).match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? null;
    return { reachable: true, title };
  } catch {
    return { reachable: false, title: null };
  } finally {
    clearTimeout(timer);
  }
}

type CgDetail = {
  detail_platforms?: Record<string, { contract_address?: string }>;
};

type BsContract = {
  name?: string | null;
  is_verified?: boolean | null;
  is_proxy?: boolean | null;
};

export type EvidenceStep = { key: string; ok: boolean; ms: number; detail?: string };
export type EvidenceStepCb = (step: EvidenceStep) => void;

function timed<T>(key: string, work: Promise<T>, onStep: EvidenceStepCb | undefined, detail: (v: T) => string | undefined): Promise<T> {
  const t0 = Date.now();
  return work.then((value) => {
    onStep?.({ key, ok: true, ms: Date.now() - t0, detail: detail(value) });
    return value;
  }).catch((error) => {
    onStep?.({ key, ok: false, ms: Date.now() - t0 });
    throw error;
  });
}

function catalogAsset(marketId: string) {
  const asset = DEMO_ASSETS.find((a) => a.marketId === marketId);
  if (!asset) throw new Error(`Unknown catalog asset: ${marketId}`);
  return asset;
}

async function liveMarket(marketId: string): Promise<EvidencePack['market']> {
  const url = new URL(`${CG}/simple/price`);
  url.searchParams.set('ids', marketId);
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');
  url.searchParams.set('include_last_updated_at', 'true');
  const raw = (await fetchJson(url.toString(), 10_000)) as Record<
    string,
    { usd?: number; usd_24h_change?: number; last_updated_at?: number }
  > | null;
  const row = raw?.[marketId];
  if (!row || typeof row.usd !== 'number') return null;
  return {
    usd: row.usd,
    change24h: typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null,
    updatedAt: typeof row.last_updated_at === 'number' ? row.last_updated_at : null,
  };
}

async function liveContract(marketId: string): Promise<{ address: string; chain: string; explorerUrl: string } | null> {
  const detail = (await fetchJson(
    `${CG}/coins/${marketId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
    12_000,
  )) as CgDetail | null;
  const address = detail?.detail_platforms?.ethereum?.contract_address;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  return { address, chain: 'ethereum', explorerUrl: `https://etherscan.io/token/${address}` };
}

async function liveVerification(address: string): Promise<EvidencePack['verification']> {
  const info = (await fetchJson(`${BLOCKSCOUT}/smart-contracts/${address}`, 12_000)) as BsContract | null;
  if (!info || typeof info.is_verified === 'undefined') {
    return { name: null, isVerified: null, isProxy: null, source: `${BLOCKSCOUT}/smart-contracts/${address}` };
  }
  return {
    name: typeof info.name === 'string' ? info.name : null,
    isVerified: info.is_verified ?? null,
    isProxy: info.is_proxy ?? null,
    source: `${BLOCKSCOUT}/smart-contracts/${address}`,
  };
}

export async function buildCatalogEvidence(marketId: string, onStep?: EvidenceStepCb): Promise<EvidencePack> {
  const asset = catalogAsset(marketId);
  const [market, contract, issuerPage] = await Promise.all([
    timed('market', liveMarket(marketId), onStep, (m) => (m ? `$${m.usd}` : 'unavailable')),
    timed('contract', liveContract(marketId), onStep, (c) => (c ? c.address : 'none found')),
    timed('issuer-page', fetchTextHead(asset.sourceUrl, 10_000), onStep, (p) => (p.reachable ? p.title ?? 'reachable' : 'unreachable')),
  ]);
  const verification = contract
    ? await timed('verification', liveVerification(contract.address), onStep, (v) => (v?.isVerified === true ? `verified · ${v.name ?? 'unknown name'}` : v?.isVerified === false ? 'unverified' : 'unreachable'))
    : null;
  return {
    subject: marketId,
    subjectKind: 'catalog-rwa',
    catalog: {
      title: asset.title,
      ticker: asset.ticker,
      issuer: asset.issuer,
      assetClass: asset.assetClass,
      networks: asset.networks,
      sourceLabel: asset.sourceLabel,
      sourceUrl: asset.sourceUrl,
      description: asset.description,
    },
    curated: curatedFacts(marketId),
    market,
    contract,
    verification,
    issuerPage: { url: asset.sourceUrl, ...issuerPage },
    ensEvidence: null,
    builtAt: new Date().toISOString(),
  };
}

export async function buildDemoAssetEvidence(ensName: string, onStep?: EvidenceStepCb): Promise<EvidencePack> {
  const verdict = await timed('ens-evidence', resolveVerdict(ensName), onStep, (v) => `${v.state} · block ${v.sourceBlock ?? '—'}`);
  if (!verdict.ok || !verdict.asset || !verdict.audit || !verdict.observation) {
    throw new Error(`Live ENS evidence unavailable for ${ensName}: ${verdict.reason}`);
  }
  return {
    subject: ensName,
    subjectKind: 'ens-demo-asset',
    ensEvidence: {
      state: verdict.state,
      reason: verdict.reason,
      daysRemaining: verdict.evidence.daysRemaining,
      fresh: verdict.evidence.fresh,
      revoked: verdict.evidence.revoked,
      riskConflict: verdict.evidence.riskConflict,
      auditStatus: verdict.audit.status,
      severity: verdict.observation.severity,
      reasonCode: verdict.observation.reasonCode,
      confidence: verdict.audit.ai.confidence,
      sourceBlock: verdict.sourceBlock,
    },
    builtAt: new Date().toISOString(),
  };
}
