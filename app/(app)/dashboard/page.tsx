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
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo, CoverageBadge, NetworkBadges } from '@/components/app/asset-identity';
import { DEMO_ACTIVITY, DEMO_ASSETS, type CoverageTier, type DemoAsset } from '@/components/app/demo-data';
import StatusChip from '@/components/app/status-chip';
import type { VerdictApiResponse } from '@/lib/verdict-types';

type Quote = { usd: number; change24h: number | null; updatedAt: number | null; image?: string };
type MarketResponse = { ok: boolean; source: string; quotes: Record<string, Quote> };
type LoadState = 'loading' | 'ready' | 'partial';

const COVERAGE_COPY: Record<CoverageTier, string> = {
  VERIFIED_ONCHAIN: 'Evidence resolved from independent ENSv2 authorities.',
  SOURCE_LINKED: 'A real product with issuer and market sources, not yet verified by Verdict.',
  MARKET_REFERENCE: 'Live comparison data only. No issuer evidence or Verdict decision.',
};

function formatUsd(value: number) {
  const digits = value >= 1000 ? 0 : value >= 1 ? 2 : 4;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatUpdated(timestamp: number | null) {
  if (!timestamp) return 'Update time unavailable';
  return `Updated ${new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

function AssetDialog({ asset, quote, live, onClose }: { asset: DemoAsset; quote?: Quote; live: VerdictApiResponse | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const verified = asset.coverage === 'VERIFIED_ONCHAIN';

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
                <dt>Identifier</dt><dd className="v-mono">{asset.name}</dd>
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

          <section className={`v-verification-panel ${verified ? 'is-verified' : ''}`} aria-labelledby="coverage-heading">
            <div>
              <div id="coverage-heading" className="v-label">Verdict coverage</div>
              <h3>{verified ? live?.state?.replace('_', ' ') ?? 'Resolving ENS evidence' : 'Not yet ENS-verified'}</h3>
              <p>{verified ? live?.reason ?? 'The live resolver is temporarily unavailable.' : COVERAGE_COPY[asset.coverage]}</p>
            </div>
            {verified && live ? (
              <dl className="v-verification-stats">
                <div><dt>Source block</dt><dd>{live.sourceBlock ?? '—'}</dd></div>
                <div><dt>Audit</dt><dd>{live.audit?.status ?? '—'} · {live.evidence.daysRemaining}d</dd></div>
                <div><dt>Risk</dt><dd>{live.observation?.severity ?? '—'}</dd></div>
                <div><dt>AI confidence</dt><dd>{live.audit?.ai.confidence ?? '—'}%</dd></div>
              </dl>
            ) : (
              <div className="v-onboarding-note"><Link2 size={16} aria-hidden="true" /><span>Next step: bind issuer, auditor, and monitor records through ENSv2 before showing a policy verdict.</span></div>
            )}
          </section>
        </div>

        <div className="v-modal-footer">
          <span className="v-modal-footnote">Market price is informational and never changes Verdict’s evidence policy.</span>
          <div className="v-dialog-actions">
            <a className="v-btn v-btn-secondary" href={asset.sourceUrl} target="_blank" rel="noreferrer">Open {asset.sourceLabel}<ExternalLink size={14} aria-hidden="true" /></a>
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
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('Resolving ENS and market sources…');
  const [query, setQuery] = useState('');
  const [coverage, setCoverage] = useState<'ALL' | CoverageTier>('ALL');
  const [assetClass, setAssetClass] = useState('ALL');
  const [selected, setSelected] = useState<DemoAsset | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    setLoadMessage('Resolving ENS and market sources…');
    const [verdictResult, marketResult] = await Promise.allSettled([
      fetch('/api/verdict', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('ENS resolver unavailable');
        return response.json() as Promise<VerdictApiResponse>;
      }),
      fetch('/api/market', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Market feed unavailable');
        return response.json() as Promise<MarketResponse>;
      }),
    ]);
    if (verdictResult.status === 'fulfilled') setLive(verdictResult.value);
    if (marketResult.status === 'fulfilled') setQuotes(marketResult.value.quotes);
    const failures = [verdictResult, marketResult].filter((result) => result.status === 'rejected').length;
    setLoadState(failures ? 'partial' : 'ready');
    setLoadMessage(failures === 2 ? 'ENS and market sources are unavailable. Retry when connectivity returns.' : failures === 1 ? 'One live source is unavailable. Verified and dated data remain clearly labeled.' : 'ENS and market sources are live.');
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const assets = useMemo(() => DEMO_ASSETS.map((asset) => {
    // Prefer the live CoinGecko CDN image returned by /api/market so photos
    // stay fresh; fall back to the verified catalog image when offline.
    const liveImage = asset.marketId ? quotes[asset.marketId]?.image : undefined;
    const withLiveImage = liveImage ? { ...asset, logo: liveImage } : asset;
    if (withLiveImage.coverage !== 'VERIFIED_ONCHAIN' || !live?.asset) return withLiveImage;
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
    verified: assets.filter((asset) => asset.coverage === 'VERIFIED_ONCHAIN').length,
    sourced: assets.filter((asset) => asset.coverage === 'SOURCE_LINKED').length,
    reference: assets.filter((asset) => asset.coverage === 'MARKET_REFERENCE').length,
  };

  async function copyIdentifier(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* Clipboard is optional. */ }
  }

  return (
    <>
      <div className="v-overview-heading">
        <div>
          <div className="v-overview-eyebrow"><span className="v-eyebrow-dot" aria-hidden="true" /><span>REAL ASSET INTELLIGENCE</span><span className="v-eyebrow-sep">·</span><span>TRUST LEVELS STAY EXPLICIT</span></div>
          <PageHead title="Real markets. Evidence attached." sub="Compare tokenized treasuries, equities, property, and crypto without confusing price data with verified trust." />
        </div>
      </div>

      <div className={`v-source-state ${loadState}`} role="status" aria-live="polite">
        <span>{loadMessage}</span>
        {loadState === 'partial' && <button type="button" onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Retry sources</button>}
      </div>

      <div className="v-metric-grid" role="region" aria-label="Catalog coverage summary">
        <button className={`v-metric-card v-metric-total ${coverage === 'ALL' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'ALL'} onClick={() => setCoverage('ALL')}><div className="v-metric-top"><span className="v-label">Catalog</span><Layers size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{assets.length}</div><div className="v-muted">Across {classes.length} asset classes</div><div className="v-metric-line"><span style={{ width: '100%' }} /></div></button>
        <button className={`v-metric-card v-metric-pass ${coverage === 'VERIFIED_ONCHAIN' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'VERIFIED_ONCHAIN'} onClick={() => setCoverage(coverage === 'VERIFIED_ONCHAIN' ? 'ALL' : 'VERIFIED_ONCHAIN')}><div className="v-metric-top"><span className="v-label">ENS verified</span><BadgeCheck size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.verified}</div><div className="v-muted">Independent onchain evidence</div><div className="v-metric-line"><span style={{ width: `${counts.verified / assets.length * 100}%` }} /></div></button>
        <button className={`v-metric-card v-metric-source ${coverage === 'SOURCE_LINKED' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'SOURCE_LINKED'} onClick={() => setCoverage(coverage === 'SOURCE_LINKED' ? 'ALL' : 'SOURCE_LINKED')}><div className="v-metric-top"><span className="v-label">Source linked</span><Database size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.sourced}</div><div className="v-muted">Real issuer-backed products</div><div className="v-metric-line"><span style={{ width: `${counts.sourced / assets.length * 100}%` }} /></div></button>
        <button className={`v-metric-card v-metric-market ${coverage === 'MARKET_REFERENCE' ? 'v-metric-active' : ''}`} type="button" aria-pressed={coverage === 'MARKET_REFERENCE'} onClick={() => setCoverage(coverage === 'MARKET_REFERENCE' ? 'ALL' : 'MARKET_REFERENCE')}><div className="v-metric-top"><span className="v-label">Market reference</span><LineChart size={18} className="v-metric-icon" aria-hidden="true" /></div><div className="v-metric">{counts.reference}</div><div className="v-muted">Context, not trust evidence</div><div className="v-metric-line"><span style={{ width: `${counts.reference / assets.length * 100}%` }} /></div></button>
      </div>

      <div className="v-card v-glass-card v-fullwidth-card">
        <div className="v-card-header"><div><div className="v-card-tag">01 / ASSET COVERAGE MAP</div><h3 className="v-section-title">Assets and evidence</h3><p className="v-muted">Logos identify the product. Network marks show where it lives. Coverage labels show what Verdict can actually prove.</p></div><div className="v-card-header-badge">{filtered.length} OF {assets.length} SHOWN</div></div>
        <div className="v-table-toolbar">
          <div className="v-table-search-box"><Search size={15} className="v-search-icon" aria-hidden="true" /><label className="v-visually-hidden" htmlFor="asset-catalog-search">Search assets</label><input id="asset-catalog-search" className="v-search-input" type="search" placeholder="Search asset, issuer, ticker, or class…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" className="v-search-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
          <div className="v-table-filter-group"><div className="v-select-wrapper"><select className="v-select-filter" aria-label="Filter by coverage" value={coverage} onChange={(event) => setCoverage(event.target.value as 'ALL' | CoverageTier)}><option value="ALL">All coverage</option><option value="VERIFIED_ONCHAIN">Verified onchain</option><option value="SOURCE_LINKED">Source linked</option><option value="MARKET_REFERENCE">Market reference</option></select></div><div className="v-select-wrapper"><select className="v-select-filter" aria-label="Filter by asset class" value={assetClass} onChange={(event) => setAssetClass(event.target.value)}><option value="ALL">All classes</option>{classes.map((value) => <option value={value} key={value}>{value}</option>)}</select></div></div>
        </div>

        <div className="v-table-wrap v-catalog-table-wrap">
          <table className="v-table v-catalog-table">
            <thead><tr><th>Asset</th><th>Coverage</th><th>Market</th><th>Category</th><th>Networks</th><th>Evidence snapshot</th><th><span className="v-visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {filtered.map((asset) => {
                const quote = asset.marketId ? quotes[asset.marketId] : undefined;
                return <tr key={asset.id} className="v-asset-row">
                  <td className="v-catalog-cell-asset"><div className="v-catalog-asset-cell"><AssetLogo asset={asset} /><div><div className="v-asset-name-group"><span className="v-asset-name">{asset.title}</span><span className="v-asset-badge">{asset.ticker}</span></div><div className="v-asset-sub-row"><span className="v-asset-sub">{asset.name}</span><button type="button" className="v-inline-copy-btn" onClick={() => void copyIdentifier(asset.name)} aria-label={`Copy ${asset.name}`}>{copied === asset.name ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}</button></div></div></div></td>
                  <td className="v-catalog-cell-coverage"><CoverageBadge coverage={asset.coverage} />{asset.coverage === 'VERIFIED_ONCHAIN' && <div className="v-verdict-inline"><StatusChip state={asset.state} /></div>}</td>
                  <td className="v-catalog-cell-market"><MarketQuote quote={quote} loading={loadState === 'loading' && Boolean(asset.marketId)} /></td>
                  <td className="v-catalog-cell-category"><div className="v-cell-main">{asset.assetClass}</div><div className="v-cell-sub">{asset.issuer}</div></td>
                  <td className="v-catalog-cell-networks"><NetworkBadges networks={asset.networks} /></td>
                  <td className="v-catalog-cell-evidence"><div className="v-cell-main">{asset.snapshot}</div><div className="v-cell-sub">{asset.snapshotAsOf}</div></td>
                  <td className="v-catalog-cell-action"><button type="button" className="v-btn-detail" onClick={() => setSelected(asset)} aria-haspopup="dialog">Inspect<ArrowUpRight size={13} aria-hidden="true" /></button></td>
                </tr>;
              })}
              {!filtered.length && <tr><td colSpan={7} className="v-table-empty"><div className="v-empty-box"><Search size={22} className="v-empty-icon" aria-hidden="true" /><p>No assets match those filters.</p><button type="button" className="v-btn v-btn-secondary" onClick={() => { setQuery(''); setCoverage('ALL'); setAssetClass('ALL'); }}>Reset filters</button></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="v-dash-bottom-grid">
        <div className="v-card v-glass-card"><div className="v-card-header"><div><div className="v-card-tag">TRUST BOUNDARY</div><h3 className="v-section-title">What each label means</h3><p className="v-muted">One clear ladder from discoverable data to enforceable evidence.</p></div><ShieldCheck size={20} className="v-sparkle-icon" aria-hidden="true" /></div><div className="v-coverage-guide"><div><CoverageBadge coverage="VERIFIED_ONCHAIN" /><p>Independent resolver records and deterministic policy are live.</p></div><div><CoverageBadge coverage="SOURCE_LINKED" /><p>Real issuer facts are linked, but Verdict has not verified them.</p></div><div><CoverageBadge coverage="MARKET_REFERENCE" /><p>Price context only. No asset-quality conclusion is made.</p></div></div></div>
        <div className="v-card v-glass-card"><div className="v-card-header"><div><div className="v-card-tag">PROTOCOL HEARTBEAT</div><h3 className="v-section-title">Recent activity</h3><p className="v-muted">The verified asset remains anchored to Sepolia evidence.</p></div><CircleDollarSign size={20} className="v-sparkle-icon" aria-hidden="true" /></div><div className="v-activity-list">{DEMO_ACTIVITY.map((event) => <div className="v-activity-item" key={event.tx}><div className="v-activity-left"><span className="v-activity-badge">{event.label}</span><div className="v-activity-desc">{event.text}</div></div><div className="v-activity-meta"><span>{event.time}</span><span className="v-mono">{event.tx}</span></div></div>)}</div></div>
      </div>

      {selected && <AssetDialog asset={selected} quote={selected.marketId ? quotes[selected.marketId] : undefined} live={live} onClose={() => setSelected(null)} />}
    </>
  );
}
