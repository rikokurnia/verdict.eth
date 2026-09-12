'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { ColoredScore } from '@/components/app/status-badge';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import type { VerdictApiResponse } from '@/lib/verdict-types';

type LoadState = 'loading' | 'ready' | 'error';
type ScoreRow = { score: number | null; status: string; reason: string; runAt: number | null; validityDays: number | null };
type ActivityTx = { hash: string; blockNumber: number; timestamp: string; from: string; method: string; contract: string };

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortHash(value: string | undefined) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—';
}

export default function LifecyclePage() {
  const [live, setLive] = useState<VerdictApiResponse | null>(null);
  const [radar, setRadar] = useState<{ marketId: string; ticker: string; title: string; score: ScoreRow }[]>([]);
  const [activity, setActivity] = useState<ActivityTx[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const [verdictResponse, scoresResponse, activityResponse] = await Promise.all([
        fetch('/api/verdict', { cache: 'no-store' }),
        fetch('/api/rwa-scores', { cache: 'no-store' }),
        fetch('/api/activity', { cache: 'no-store' }),
      ]);
      if (!verdictResponse.ok) throw new Error('resolver unavailable');
      setLive((await verdictResponse.json()) as VerdictApiResponse);
      if (scoresResponse.ok) {
        const body = (await scoresResponse.json()) as { ok: boolean; scores: Record<string, ScoreRow> };
        if (body.ok) {
          const rows = DEMO_ASSETS.filter((a) => a.marketId && body.scores[a.marketId]).map((a) => ({
            marketId: a.marketId as string,
            ticker: a.ticker,
            title: a.title,
            score: body.scores[a.marketId as string],
          }));
          const horizon = (r: ScoreRow) => (r.runAt && r.validityDays ? r.runAt + r.validityDays * 86_400 : Number.MAX_SAFE_INTEGER);
          rows.sort((x, y) => horizon(x.score) - horizon(y.score));
          setRadar(rows);
        }
      }
      if (activityResponse.ok) {
        const body = (await activityResponse.json()) as { ok: boolean; transactions: ActivityTx[] };
        if (body.ok) setActivity(body.transactions);
      }
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const explorer = ENSV2_SEPOLIA.explorer;
  const now = live?.evaluatedAt ?? Math.floor(Date.now() / 1000);

  const issuedAt = live?.audit?.issuedAt ?? null;
  const observedAt = live?.observation?.observedAt ?? null;
  const expiresAt = live?.audit?.expiresAt ?? null;
  const reviewAt = expiresAt !== null ? expiresAt - 14 * 86_400 : null;
  const inReviewWindow = reviewAt !== null && now >= reviewAt && expiresAt !== null && now < expiresAt;
  const expired = expiresAt !== null && now >= expiresAt;

  const assetResolver = live?.sources[0]?.resolver;
  const auditSource = live?.sources[1];
  const observationSource = live?.sources[2];

  return (
    <>
      <PageHead title="Lifecycle" sub="Expiry, revocation and permanent states — derived live from Sepolia evidence, not mockups." />

      <div className={`v-source-state ${loadState === 'ready' ? 'ready' : loadState}`} role="status" aria-live="polite">
        <span>
          {loadState === 'loading' && 'Resolving live lifecycle state from ENSv2…'}
          {loadState === 'ready' && `Live at source block ${live?.sourceBlock} · policy ${live?.policyId}`}
          {loadState === 'error' && 'ENS resolver unavailable. Lifecycle cannot be inferred from missing evidence.'}
        </span>
        {loadState === 'error' && <button type="button" onClick={() => void refresh()}><RefreshCw size={14} aria-hidden="true" />Retry</button>}
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Timeline · live timestamps</div>
        <div className="v-timeline">
          <div className={`v-tick ${issuedAt ? 'done' : ''}`}>Issued {issuedAt ? `✓ ${formatDate(issuedAt)}` : '· pending'}</div>
          <div className={`v-tick ${observedAt && live?.evidence.fresh ? 'done' : observedAt ? 'warn' : ''}`}>Observed {observedAt ? `${live?.evidence.fresh ? '✓' : '▲'} ${formatDate(observedAt)}` : '· pending'}</div>
          <div className={`v-tick ${inReviewWindow ? 'warn' : reviewAt && now < reviewAt ? 'done' : ''}`}>Review window {inReviewWindow ? '▲ active' : reviewAt ? formatDate(reviewAt) : '· pending'}</div>
          <div className={`v-tick ${expired ? 'bad' : ''}`}>Expiry {expiresAt ? `${expired ? '×' : ''} ${formatDate(expiresAt)}` : '· pending'}</div>
        </div>
      </div>

      {live && loadState === 'ready' && (
        <div className="v-card" style={{ marginTop: 16 }}>
          <div className="v-label">Evidence provenance</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Asset resolver</dt><dd className="v-mono"><a href={`${explorer}/address/${assetResolver}`} target="_blank" rel="noreferrer">{shortHash(assetResolver)} ↗</a></dd>
            <dt>Audit branch</dt><dd className="v-mono">{auditSource?.name} · <a href={`${explorer}/address/${auditSource?.resolver}`} target="_blank" rel="noreferrer">{shortHash(auditSource?.resolver)} ↗</a></dd>
            <dt>Risk branch</dt><dd className="v-mono">{observationSource?.name} · <a href={`${explorer}/address/${observationSource?.resolver}`} target="_blank" rel="noreferrer">{shortHash(observationSource?.resolver)} ↗</a></dd>
            <dt>Heartbeat</dt><dd>{live.evidence.fresh ? 'fresh' : 'stale'}</dd>
          </dl>
        </div>
      )}

      <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">RENEWAL RADAR</div>
            <h3 className="v-section-title">Conclusion horizons · all 20 assets</h3>
            <p className="v-muted">Each onchain conclusion carries its validity window. Expiring soon? Re-score from the radar or inspect in depth.</p>
          </div>
        </div>
        <div className="v-table-wrap">
          <table className="v-table">
            <thead><tr><th>Asset</th><th>Conclusion</th><th>Expires in</th><th><span className="v-visually-hidden">Action</span></th></tr></thead>
            <tbody>
              {radar.map((row) => {
                const expiresAt = row.score.runAt && row.score.validityDays ? row.score.runAt + row.score.validityDays * 86_400 : null;
                const left = expiresAt === null ? null : Math.floor((expiresAt - now) / 86_400);
                return (
                  <tr key={row.marketId}>
                    <td><span className="v-asset-name">{row.title}</span> <span className="v-asset-badge">{row.ticker}</span></td>
                    <td><ColoredScore score={row.score.score} /></td>
                    <td>{left === null ? '—' : left < 0 ? <span className="v-block-t">expired {Math.abs(left)}d ago</span> : left === 0 ? 'today' : `${left}d`}</td>
                    <td><a className="v-btn-detail" href={`/agents/inspect/${encodeURIComponent(row.marketId)}`}>Inspect<ArrowUpRight size={13} aria-hidden="true" /></a></td>
                  </tr>
                );
              })}
              {!radar.length && <tr><td colSpan={4} className="v-table-empty">No scored conclusions yet — run a curator refresh from the radar.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">ONCHAIN ACTIVITY</div>
            <h3 className="v-section-title">Live Sepolia writes</h3>
            <p className="v-muted">Every record write, registration, and role change across Verdict contracts.</p>
          </div>
        </div>
        <div className="v-activity-list">
          {activity.map((tx) => (
            <div className="v-activity-item" key={`${tx.hash}-${tx.contract}`}>
              <div className="v-activity-left">
                <span className="v-activity-badge">{tx.contract}</span>
                <div className="v-activity-desc v-mono">{tx.method} · from {shortHash(tx.from)}</div>
              </div>
              <div className="v-activity-meta">
                <span>{tx.timestamp ? new Date(tx.timestamp).toLocaleString() : `block ${tx.blockNumber}`}</span>
                <a className="v-mono" href={`${explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">{shortHash(tx.hash)} ↗</a>
              </div>
            </div>
          ))}
          {!activity.length && <p className="v-muted">No recent writes indexed — activity appears here as the loop runs.</p>}
        </div>
      </div>
    </>
  );
}
