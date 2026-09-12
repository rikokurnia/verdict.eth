'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  CircleDollarSign,
  Copy,
  Database,
  ExternalLink,
  Layers,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo, CoverageBadge, NetworkBadges } from '@/components/app/asset-identity';
import { DEMO_ACTIVITY, DEMO_ASSETS, type CoverageTier, type DemoAsset } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA, ENS_EXPLORER_NAME_URL } from '@/lib/ensv2-config';
import { StatusBadge, getAssetVerdict } from '@/components/app/status-badge';
import type { VerdictApiResponse } from '@/lib/verdict-types';

type Quote = { usd: number; change24h: number | null; updatedAt: number | null; image?: string };
type MarketResponse = { ok: boolean; source: string; stale?: boolean; savedAt?: string; quotes: Record<string, Quote> };
type RwaScore = { score: number | null; status: string; policy: string; reason: string; summary: string; runAt: number | null; sourceHash: string };
type ScoresResponse = { ok: boolean; sourceBlock?: number; scores: Record<string, RwaScore> };
type SeedReceipt = { file: string; receipt: { startedAt: string; results: { marketId?: string; name?: string; action?: string; verdict?: string; score?: number; transaction?: { hash: string; blockNumber: number } }[]; remaining?: number; done?: boolean } };
type LoadState = 'loading' | 'ready' | 'partial';

const COVERAGE_COPY: Record<CoverageTier, string> = {
  POLICY_VERIFIED: 'Deterministic onchain policy over independent ENSv2 authorities.',
  CONSENSUS_SCORED: 'Latest agent consensus written to its ENS profile.',
  REGISTERED: 'ENS identity records exist. No conclusion published yet.',
  REFERENCE: 'Price context only. No trust conclusion is made.',
};

function formatUsd(value: number) {
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatUpdated(timestamp: number | null) {
  if (!timestamp) return 'Update time unavailable';
  return `Updated ${new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatAge(runAt: number | null) {
  if (!runAt) return null;
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - runAt);
  if (elapsed < 3600) return 'scored just now';
  if (elapsed < 86_400) return `scored ${Math.floor(elapsed / 3600)}h ago`;
  return `scored ${Math.floor(elapsed / 86_400)}d ago`;
}

function MarketQuote({ quote, loading }: { quote?: Quote; loading: boolean }) {
  if (loading) return <span className="v-market-skeleton" aria-label="Loading market price" />;
  if (!quote) return <><div className="v-cell-main">Not available</div><div className="v-cell-sub">Issuer source only</div></>;
  const change = quote.change24h;
  return (
    <>
      <div className="v-market-price">{formatUsd(quote.usd)}</div>
      <div className={`v-market-change ${change !== null && change < 0 ? 'is-down' : 'is-up'}`}>
        {change === null ? '24h unavailable' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}% · 24h`}
      </div>
    </>
  );
}

function VerdictCell({ asset, score, live }: { asset: DemoAsset; score?: RwaScore | null; live: VerdictApiResponse | null }) {
  const verdict = getAssetVerdict(asset, score);
  const age = score ? formatAge(score.runAt) : null;
  return (
    <>
      <StatusBadge status={verdict} size="md" />
      <div className="v-cell-sub" style={{ marginTop: 4 }}>
        {asset.coverage === 'POLICY_VERIFIED'
          ? (live ? `${live.state.replace('_', ' ')} · live` : 'Resolving evidence…')
          : asset.coverage === 'CONSENSUS_SCORED'
            ? (score?.score !== null && score?.score !== undefined ? `${score.score}/100 · ${age ?? ''}` : 'Awaiting seed')
            : 'Market context'}
      </div>
    </>
  );
}

function AssetDialog({ asset, quote, live, score, onClose }: { asset: DemoAsset; quote?: Quote; live: VerdictApiResponse | null; score?: RwaScore | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const verified = asset.coverage === 'POLICY_VERIFIED';
  const scored = asset.coverage === 'CONSENSUS_SCORED' && score?.score !== null && score?.score !== undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="v-native-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="asset-dialog-title">
      <div className="v-modal-dialog v-catalog-dialog">
        <div className="v-modal-header">
          <div className="v-dialog-identity">
            <AssetLogo asset={asset} size={52} />
            <div>
              <div className="v-modal-eyebrow"><span>{asset.assetClass}</span><span className="v-modal-dot" /><span>{asset.ticker}</span></div>
              <h2 id="asset-dialog-title" className="v-modal-title">{asset.title}</h2>
              <CoverageBadge coverage={asset.coverage} />
            </div>
          </div>
          <button type="button" className="v-modal-close" onClick={() => dialogRef.current?.close()} aria-label="Close asset details"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="v-modal-body">
          <div className="v-catalog-detail-grid">
            <section className="v-modal-subcard" aria-labelledby="asset-profile-heading">
              <div id="asset-profile-heading" className="v-label">Asset profile</div>
              <p className="v-asset-description">{asset.description}</p>
              <dl className="v-kv">
                <dt>Issuer</dt><dd>{asset.issuer}</dd>
                <dt>Category</dt><dd>{asset.assetClass}</dd>
                <dt>Networks</dt><dd><NetworkBadges networks={asset.networks} /></dd>
                <dt>Identifier</dt>
                <dd className="v-mono">
                  {asset.name}
                  {asset.name.endsWith('.eth') && (
                    <a
                      className="v-inline-copy-btn"
                      href={ENS_EXPLORER_NAME_URL(asset.name)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${asset.name} on app.ens.domains`}
                      title="Open on app.ens.domains"
                      style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </dd>
              </dl>
            </section>

            <section className="v-modal-subcard" aria-labelledby="market-profile-heading">
              <div id="market-profile-heading" className="v-label">Market and issuer snapshot</div>
              <div className="v-dialog-price">{quote ? formatUsd(quote.usd) : 'No unified market quote'}</div>
              {quote && <div className={`v-market-change ${quote.change24h !== null && quote.change24h < 0 ? 'is-down' : 'is-up'}`}>{quote.change24h === null ? '24h change unavailable' : `${quote.change24h >= 0 ? '+' : ''}${quote.change24h.toFixed(2)}% over 24h`} · {formatUpdated(quote.updatedAt)}</div>}
              <p className="v-source-snapshot">{asset.snapshot}</p>
              <span className="v-cell-sub">{asset.snapshotAsOf}</span>
            </section>
          </div>

          <section className={`v-verification-panel ${verified || scored ? 'is-verified' : ''}`} aria-labelledby="coverage-heading">
            <div>
              <div id="coverage-heading" className="v-label">Trust status</div>
              {verified ? (
                <>
                  <h3>{live?.state?.replace('_', ' ') ?? 'Resolving ENS evidence'}</h3>
                  <p>{live?.reason ?? 'The live resolver is temporarily unavailable.'}</p>
                </>
              ) : scored && score ? (
                <>
                  <h3>{score.policy.replace('_', ' ')} · {score.score}/100</h3>
                  <p>{score.summary || score.reason} · {formatAge(score.runAt) ?? 'recently'} · onchain ✓</p>
                </>
              ) : (
                <>
                  <h3>{asset.coverage === 'REFERENCE' ? 'Market reference' : 'Registered — awaiting consensus'}</h3>
                  <p>{COVERAGE_COPY[asset.coverage]}</p>
                </>
              )}
            </div>
            {verified && live ? (
              <dl className="v-verification-stats">
                <div><dt>Source block</dt><dd>{live.sourceBlock ?? '—'}</dd></div>
                <div><dt>Audit</dt><dd>{live.audit?.status ?? '—'} · {live.evidence.daysRemaining}d</dd></div>
                <div><dt>Risk</dt><dd>{live.observation?.severity ?? '—'}</dd></div>
                <div><dt>Heartbeat</dt><dd>{live.evidence.fresh ? 'fresh' : 'stale'}</dd></div>
              </dl>
            ) : scored && score ? (
              <dl className="v-verification-stats">
                <div><dt>Reason</dt><dd className="v-mono">{score.reason || '—'}</dd></div>
                <div><dt>Source hash</dt><dd className="v-mono">{score.sourceHash ? `${score.sourceHash.slice(0, 10)}…${score.sourceHash.slice(-6)}` : '—'}</dd></div>
              </dl>
            ) : null}
          </section>
        </div>

        <div className="v-modal-footer">
          <span className="v-modal-footnote">Market price is informational and never changes evidence verdicts.</span>
          <div className="v-dialog-actions">
            {asset.marketId && (
              <a className="v-btn v-btn-secondary" href={`/agents?subject=${encodeURIComponent(asset.marketId)}`}>Full inspection<ArrowUpRight size={14} aria-hidden="true" /></a>
            )}
            {asset.name.endsWith('.eth') && (
              <a className="v-btn v-btn-secondary" href={`/assets/${encodeURIComponent(asset.name)}`}>Onchain ENS proof<ArrowUpRight size={14} aria-hidden="true" /></a>
            )}
            <button type="button" className="v-btn" onClick={() => dialogRef.current?.close()}>Close</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export default function DashboardPage() {
  const [live, setLive] = useState<VerdictApiResponse | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [scores, setScores] = useState<Record<string, RwaScore>>({});
  const [receipts, setReceipts] = useState<SeedReceipt[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('Resolving ENS and market sources…');
  const [query, setQuery] = useState('');
  const [coverage, setCoverage] = useState<'ALL' | CoverageTier>('ALL');
  const [assetClass, setAssetClass] = useState('ALL');
  const [selected, setSelected] = useState<DemoAsset | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [seeding, setSeeding] = useState<{ active: boolean; log: string }>({ active: false, log: '' });
  const [reauditing, setReauditing] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    try {
      const response = await fetch('/api/rwa-scores', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as ScoresResponse;
      if (body.ok) setScores(body.scores);
    } catch { /* Scores are progressive enhancement. */ }
  }, []);

  const loadReceipts = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/seed', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as { ok: boolean; receipts: SeedReceipt[] };
      if (body.ok) setReceipts(body.receipts);
    } catch { /* Receipts are optional. */ }
  }, []);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    setLoadMessage('Resolving ENS and market sources…');
    const [verdictResult, marketResult, scoresResult] = await Promise.allSettled([
      fetch('/api/verdict', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('ENS resolver unavailable');
        return response.json() as Promise<VerdictApiResponse>;
      }),
      fetch('/api/market', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Market feed unavailable');
        return response.json() as Promise<MarketResponse>;
      }),
      fetch('/api/rwa-scores', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Scores unavailable');
        return response.json() as Promise<ScoresResponse>;
      }),
    ]);
    if (verdictResult.status === 'fulfilled') setLive(verdictResult.value);
    if (marketResult.status === 'fulfilled') setQuotes(marketResult.value.quotes);
    if (scoresResult.status === 'fulfilled' && scoresResult.value.ok) setScores(scoresResult.value.scores);
    const marketStale = marketResult.status === 'fulfilled' && marketResult.value.stale === true;
    const failures = [verdictResult, marketResult].filter((result) => result.status === 'rejected').length;
    setLoadState(failures ? 'partial' : marketStale ? 'partial' : 'ready');
    setLoadMessage(
      failures === 2 ? 'ENS and market sources are unavailable. Retry when connectivity returns.'
      : failures === 1 ? 'One live source is unavailable. Verified and dated data remain clearly labeled.'
      : marketStale ? `Market feed rate-limited — showing last cached snapshot${marketResult.status === 'fulfilled' && marketResult.value.savedAt ? ` (${new Date(marketResult.value.savedAt).toLocaleTimeString()})` : ''}. Prices may lag.`
      : 'ENS and market sources are live.',
    );
  }, []);

  useEffect(() => { void refresh(); void loadReceipts(); }, [refresh, loadReceipts]);

  async function refreshScores() {
    if (seeding.active) return;
    setSeeding({ active: true, log: 'Curator refresh started — scoring stale profiles…' });
    try {
      let offset = 0;
      let scored = 0;
      for (let batch = 0; batch < 4; batch += 1) {
        const response = await fetch('/api/agents/seed', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ limit: 5, offset, onlyStale: true }),
        });
        const body = (await response.json()) as { ok: boolean; receipt?: { results: { action?: string }[]; done?: boolean }; error?: string };
        if (!response.ok || !body.ok || !body.receipt) throw new Error(body.error ?? 'Seed batch failed');
        scored += body.receipt.results.filter((r) => r.action === 'scored').length;
        setSeeding({ active: true, log: `Batch ${batch + 1}: ${scored} scored so far…` });
        if (body.receipt.done) break;
        offset += 5;
      }
      await loadScores();
      await loadReceipts();
      setSeeding({ active: false, log: `Refresh complete — ${scored} profile${scored === 1 ? '' : 's'} re-scored onchain.` });
    } catch (error) {
      setSeeding({ active: false, log: error instanceof Error ? error.message : 'Refresh failed.' });
    }
  }

  async function reaudit(marketId: string) {
    if (reauditing) return;
    setReauditing(marketId);
    try {
      const response = await fetch('/api/agents/seed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ limit: 1, onlyStale: false, marketIds: [marketId] }),
      });
      if (!response.ok) throw new Error('Re-audit failed');
      await loadScores();
      await loadReceipts();
    } catch { /* Errors surface via unchanged scores. */ }
    setReauditing(null);
  }

  const assets = useMemo(() => DEMO_ASSETS.map((asset) => {
    // Prefer the live CoinGecko CDN image returned by /api/market so photos
    // stay fresh; fall back to the verified catalog image when offline.
    const liveImage = asset.marketId ? quotes[asset.marketId]?.image : undefined;
    const withLiveImage = liveImage ? { ...asset, logo: liveImage } : asset;
    if (withLiveImage.coverage !== 'POLICY_VERIFIED' || !live?.asset) return withLiveImage;
    const elapsed = Math.max(0, live.evaluatedAt - (live.observation?.observedAt ?? live.evaluatedAt));
    return {
      ...withLiveImage,
      title: live.asset.displayName,
      ticker: live.asset.ticker,
      issuer: live.asset.issuer,
      state: live.state,
      auditNote: live.audit ? `${live.audit.status} · ${live.evidence.daysRemaining}d` : 'Unavailable',
      riskNote: live.observation?.severity ?? 'Unavailable',
      heartbeat: elapsed < 60 ? `${elapsed}s ago` : `${Math.floor(elapsed / 60)}m ago`,
    };
  }), [live, quotes]);

  const classes = useMemo(() => [...new Set(assets.map((asset) => asset.assetClass))].sort(), [assets]);
  const filtered = assets.filter((asset) => {
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || [asset.title, asset.ticker, asset.name, asset.issuer, asset.assetClass].some((value) => value.toLowerCase().includes(needle));
    return matchesQuery && (coverage === 'ALL' || asset.coverage === coverage) && (assetClass === 'ALL' || asset.assetClass === assetClass);
  });
  const counts = {
    verified: assets.filter((asset) => asset.coverage === 'POLICY_VERIFIED').length,
    scored: assets.filter((asset) => asset.coverage === 'CONSENSUS_SCORED').length,
    reference: assets.filter((asset) => asset.coverage === 'REFERENCE').length,
  };

  async function copyIdentifier(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* Clipboard is optional. */ }
  }

  const latestReceipt = receipts[0]?.receipt;
  const scoredCount = Object.values(scores).filter((s) => s.score !== null).length;

  return (
    <>
      <div className="v-overview-heading">
        <div>
          <div className="v-overview-eyebrow"><span className="v-eyebrow-dot" aria-hidden="true" /><span>REAL ASSET INTELLIGENCE</span><span className="v-eyebrow-sep">·</span><span>ONE SHARED TRUTH</span></div>
          <PageHead title="Radar: 20 assets, watched." sub="Every row carries its latest onchain conclusion. For full depth on anything — listed or not — investigate in Agents." />
        </div>
        <button type="button" className="v-btn" onClick={() => void refreshScores()} disabled={seeding.active} aria-busy={seeding.active}>
          <RefreshCw size={14} aria-hidden="true" />{seeding.active ? 'Refreshing…' : 'Refresh stale scores'}
        </button>
      </div>
      {(seeding.active || seeding.log) && (
        <div className="v-source-state ready" role="status" aria-live="polite"><span>{seeding.log}</span></div>
      )}

      <div className={`v-source-state ${loadState}`} role="status" aria-live="polite">
        <span>{loadMessage}{scoredCount > 0 ? ` · ${scoredCount}/20 conclusions onchain` : ''}</span>
        {loadState === 'partial' && <button type="button" onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Retry sources</button>}
      </div>

      <div className="v-metric-grid" role="region" aria-label="Catalog coverage summary">
        <button className={`v-metric-card v-metric-total ${coverage === 'ALL' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'ALL'} onClick={() => setCoverage('ALL')}><div className="v-metric-top"><span className="v-label">Catalog</span><Layers size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{assets.length}</div><div className="v-muted">Across {classes.length} asset classes</div><div className="v-metric-line"><span style={{ width: '100%' }} /></div></button>
        <button className={`v-metric-card v-metric-pass ${coverage === 'POLICY_VERIFIED' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'POLICY_VERIFIED'} onClick={() => setCoverage(coverage === 'POLICY_VERIFIED' ? 'ALL' : 'POLICY_VERIFIED')}><div className="v-metric-top"><span className="v-label">Policy-Verified</span><BadgeCheck size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.verified}</div><div className="v-muted">Deterministic onchain policy</div><div className="v-metric-line"><span style={{ width: `${counts.verified / assets.length * 100}%` }} /></div></button>
        <button className={`v-metric-card v-metric-source ${coverage === 'CONSENSUS_SCORED' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'CONSENSUS_SCORED'} onClick={() => setCoverage(coverage === 'CONSENSUS_SCORED' ? 'ALL' : 'CONSENSUS_SCORED')}><div className="v-metric-top"><span className="v-label">Consensus-Scored</span><Database size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.scored}</div><div className="v-muted">Agent consensus onchain</div><div className="v-metric-line"><span style={{ width: `${counts.scored / assets.length * 100}%` }} /></div></button>
        <button className={`v-metric-card v-metric-market ${coverage === 'REFERENCE' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'REFERENCE'} onClick={() => setCoverage(coverage === 'REFERENCE' ? 'ALL' : 'REFERENCE')}><div className="v-metric-top"><span className="v-label">Reference</span><LineChart size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.reference}</div><div className="v-muted">Context, not conclusions</div><div className="v-metric-line"><span style={{ width: `${counts.reference / assets.length * 100}%` }} /></div></button>
      </div>

      <div className="v-card v-glass-card v-fullwidth-card">
        <div className="v-card-header"><div><div className="v-card-tag">01 / TRUST STATUS MAP</div><h3 className="v-section-title">Assets and conclusions</h3><p className="v-muted">One badge per asset: tier · verdict · score · age. Full evidence lives one click away.</p></div><div className="v-card-header-badge">{filtered.length} OF {assets.length} SHOWN</div></div>
        <div className="v-table-toolbar">
          <div className="v-table-search-box"><Search size={15} className="v-search-icon" aria-hidden="true" /><label className="v-visually-hidden" htmlFor="asset-catalog-search">Search assets</label><input id="asset-catalog-search" className="v-search-input" type="search" placeholder="Search asset, issuer, ticker, or class…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="v-search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
          <div className="v-table-filter-group"><div className="v-select-wrapper"><select className="v-select-filter" aria-label="Filter by trust status" value={coverage} onChange={(event) => setCoverage(event.target.value as 'ALL' | CoverageTier)}><option value="ALL">All statuses</option><option value="POLICY_VERIFIED">Policy-Verified</option><option value="CONSENSUS_SCORED">Consensus-Scored</option><option value="REGISTERED">Registered</option><option value="REFERENCE">Reference</option></select></div><div className="v-select-wrapper"><select className="v-select-filter" aria-label="Filter by asset class" value={assetClass} onChange={(event) => setAssetClass(event.target.value)}><option value="ALL">All classes</option>{classes.map((value) => <option value={value} key={value}>{value}</option>)}</select></div></div>
        </div>

        <div className="v-table-wrap v-catalog-table-wrap">
          <table className="v-table v-catalog-table">
            <thead>
              <tr>
                <th className="v-catalog-th-asset">Asset</th>
                <th className="v-catalog-th-verdict">Trust status</th>
                <th className="v-catalog-th-market">Market</th>
                <th className="v-catalog-th-category">Category</th>
                <th className="v-catalog-th-networks">Networks</th>
                <th className="v-catalog-th-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((asset) => {
                const quote = asset.marketId ? quotes[asset.marketId] : undefined;
                const score = asset.marketId ? scores[asset.marketId] : undefined;
                return <tr key={asset.id} className="v-asset-row">
                  <td className="v-catalog-cell-asset"><div className="v-catalog-asset-cell"><AssetLogo asset={asset} /><div><div className="v-asset-name-group"><span className="v-asset-name">{asset.title}</span><span className="v-asset-badge">{asset.ticker}</span></div><div className="v-asset-sub-row"><span className="v-asset-sub">{asset.name}</span><button type="button" className="v-inline-copy-btn" onClick={() => void copyIdentifier(asset.name)} aria-label={`Copy ${asset.name}`}>{copied === asset.name ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}</button>{asset.name.endsWith('.eth') && <a className="v-inline-copy-btn" href={ENS_EXPLORER_NAME_URL(asset.name)} target="_blank" rel="noreferrer" aria-label={`Open ${asset.name} on app.ens.domains`} title={`Open ${asset.name} on app.ens.domains`}><ExternalLink size={12} aria-hidden="true" /></a>}</div></div></div></td>
                  <td className="v-catalog-cell-verdict"><VerdictCell asset={asset} score={score} live={live} /></td>
                  <td className="v-catalog-cell-market"><MarketQuote quote={quote} loading={loadState === 'loading' && Boolean(asset.marketId)} /></td>
                  <td className="v-catalog-cell-category"><div className="v-cell-main">{asset.assetClass}</div><div className="v-cell-sub">{asset.issuer}</div></td>
                  <td className="v-catalog-cell-networks"><NetworkBadges networks={asset.networks} /></td>
                  <td className="v-catalog-cell-action">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="v-btn-detail" onClick={() => setSelected(asset)} aria-haspopup="dialog">Inspect<ArrowUpRight size={13} aria-hidden="true" /></button>
                      {asset.marketId && asset.coverage === 'CONSENSUS_SCORED' && (
                        <button type="button" className="v-btn-detail" onClick={() => void reaudit(asset.marketId as string)} disabled={reauditing !== null} aria-label={`Re-audit ${asset.ticker}`}>
                          {reauditing === asset.marketId ? '…' : 'Re-audit'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan={6} className="v-table-empty"><div className="v-empty-box"><Search size={22} className="v-empty-icon" aria-hidden="true" /><p>No assets match those filters.</p><button type="button" className="v-btn v-btn-secondary" onClick={() => { setQuery(''); setCoverage('ALL'); setAssetClass('ALL'); }}>Reset filters</button></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {latestReceipt && (
        <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
          <div className="v-card-header"><div><div className="v-card-tag">CURATOR RECEIPTS</div><h3 className="v-section-title">Latest refresh · {new Date(latestReceipt.startedAt).toLocaleString()}</h3><p className="v-muted">Every bulk refresh publishes its caller and transactions. No silent updates.</p></div></div>
          <div className="v-activity-list">
            {latestReceipt.results.map((result, i) => (
              <div className="v-activity-item" key={`${result.marketId ?? result.name ?? i}`}>
                <div className="v-activity-left">
                  <span className="v-activity-badge">{result.action === 'scored' ? `${result.verdict} · ${result.score}` : (result.action ?? 'skipped')}</span>
                  <div className="v-activity-desc">{result.name}</div>
                </div>
                <div className="v-activity-meta">
                  {'transaction' in result && result.transaction && typeof result.transaction === 'object' && 'hash' in (result.transaction as object) ? (
                    <a className="v-mono" href={`${ENSV2_SEPOLIA.explorer}/tx/${(result.transaction as { hash: string }).hash}`} target="_blank" rel="noreferrer">
                      {(result.transaction as { hash: string }).hash.slice(0, 10)}…{(result.transaction as { hash: string }).hash.slice(-6)} ↗
                    </a>
                  ) : <span className="v-mono">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="v-dash-bottom-grid">
        <div className="v-card v-glass-card"><div className="v-card-header"><div><div className="v-card-tag">TRUST STATUS</div><h3 className="v-section-title">What each label means</h3><p className="v-muted">One label per asset: tier · verdict · score · age.</p></div><ShieldCheck size={20} className="v-sparkle-icon" aria-hidden="true" /></div><div className="v-coverage-guide"><div><CoverageBadge coverage="POLICY_VERIFIED" /><p>{COVERAGE_COPY.POLICY_VERIFIED}</p></div><div><CoverageBadge coverage="CONSENSUS_SCORED" /><p>{COVERAGE_COPY.CONSENSUS_SCORED}</p></div><div><CoverageBadge coverage="REGISTERED" /><p>{COVERAGE_COPY.REGISTERED}</p></div><div><CoverageBadge coverage="REFERENCE" /><p>{COVERAGE_COPY.REFERENCE}</p></div></div></div>
        <div className="v-card v-glass-card"><div className="v-card-header"><div><div className="v-card-tag">PROTOCOL HEARTBEAT</div><h3 className="v-section-title">Recent activity</h3><p className="v-muted">The verified asset remains anchored to Sepolia evidence.</p></div><CircleDollarSign size={20} className="v-sparkle-icon" aria-hidden="true" /></div><div className="v-activity-list">{DEMO_ACTIVITY.map((event) => <div className="v-activity-item" key={event.tx}><div className="v-activity-left"><span className="v-activity-badge">{event.label}</span><div className="v-activity-desc">{event.text}</div></div><div className="v-activity-meta"><span>{event.time}</span><span className="v-mono">{event.tx}</span></div></div>)}</div></div>
      </div>

      {selected && <AssetDialog asset={selected} quote={selected.marketId ? quotes[selected.marketId] : undefined} score={selected.marketId ? scores[selected.marketId] : undefined} live={live} onClose={() => setSelected(null)} />}
    </>
  );
}
