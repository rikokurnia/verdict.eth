'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo, EnsLogo } from '@/components/app/asset-identity';
import { ColoredScore } from '@/components/app/status-badge';
import { DEMO_ASSETS, type DemoAsset } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

type LoadState = 'loading' | 'ready' | 'error';
type ScoreRow = {
  score: number | null;
  status: string;
  reason: string;
  runAt: number | null;
  validityDays: number | null;
};
type ActivityTx = {
  hash: string;
  blockNumber: number;
  timestamp: string;
  from: string;
  method: string;
  contract: string;
};

type RadarRow = {
  asset: DemoAsset;
  marketId: string;
  ticker: string;
  title: string;
  score: ScoreRow;
};

function shortHash(value: string | undefined) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—';
}

function ExpiryCountdownBar({
  runAt,
  validityDays,
  now,
}: {
  runAt: number | null;
  validityDays: number | null;
  now: number;
}) {
  if (!runAt || !validityDays) {
    return <span className="v-muted">—</span>;
  }

  const totalDurationSec = validityDays * 86_400;
  const expiresAt = runAt + totalDurationSec;
  const remainingSec = expiresAt - now;

  if (remainingSec <= 0) {
    const expiredAgoSec = Math.abs(remainingSec);
    const expiredDays = Math.floor(expiredAgoSec / 86_400);
    const expiredHours = Math.floor((expiredAgoSec % 86_400) / 3600);
    const label = expiredDays > 0 ? `Expired ${expiredDays}d ago` : `Expired ${expiredHours}h ago`;
    return (
      <div className="v-expiry-cell">
        <div className="v-expiry-header">
          <span className="v-expiry-countdown v-score-red">{label}</span>
          <span className="v-expiry-pct">0.0%</span>
        </div>
        <div className="v-expiry-track" role="progressbar" aria-valuenow={0} aria-valuemin={0} aria-valuemax={100}>
          <div className="v-expiry-fill v-expiry-fill-red" style={{ width: '0%' }} />
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (remainingSec / totalDurationSec) * 100));
  const days = Math.floor(remainingSec / 86_400);
  const hours = Math.floor((remainingSec % 86_400) / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = Math.floor(remainingSec % 60);

  let countdownText = '';
  if (days > 0) {
    countdownText = `${days}d ${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  } else if (hours > 0) {
    countdownText = `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  } else {
    countdownText = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }

  let tone = 'green';
  if (pct <= 20) {
    tone = 'red';
  } else if (pct <= 50) {
    tone = 'yellow';
  }

  return (
    <div className="v-expiry-cell">
      <div className="v-expiry-header">
        <span className={`v-expiry-countdown v-score-${tone}`}>
          {countdownText}
        </span>
        <span className="v-expiry-pct">{pct.toFixed(1)}%</span>
      </div>
      <div className="v-expiry-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`v-expiry-fill v-expiry-fill-${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function LifecyclePage() {
  const [radar, setRadar] = useState<RadarRow[]>([]);
  const [activity, setActivity] = useState<ActivityTx[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const [scoresResponse, activityResponse] = await Promise.all([
        fetch('/api/rwa-scores', { cache: 'no-store' }),
        fetch('/api/activity', { cache: 'no-store' }),
      ]);
      if (scoresResponse.ok) {
        const body = (await scoresResponse.json()) as { ok: boolean; scores: Record<string, ScoreRow> };
        if (body.ok) {
          const rows: RadarRow[] = DEMO_ASSETS.filter((a) => a.marketId && body.scores[a.marketId]).map((a) => ({
            asset: a,
            marketId: a.marketId as string,
            ticker: a.ticker,
            title: a.title,
            score: body.scores[a.marketId as string],
          }));
          const horizon = (r: RadarRow) => (r.score.runAt && r.score.validityDays ? r.score.runAt + r.score.validityDays * 86_400 : Number.MAX_SAFE_INTEGER);
          rows.sort((x, y) => horizon(x) - horizon(y));
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

  return (
    <>
      <PageHead
        title="Lifecycle"
        sub="Continuous onchain validity horizons, real-time expiration countdowns, and live ledger writes."
      />

      <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">RENEWAL RADAR</div>
            <h3 className="v-section-title">Conclusion Horizons</h3>
            <p className="v-muted">Each onchain audit conclusion carries an enforced validity window. Track active coverage and renewal schedules across monitored assets.</p>
          </div>
          <button type="button" className="v-btn" onClick={() => void refresh()} disabled={loadState === 'loading'}>
            <RefreshCw size={14} aria-hidden="true" />
            {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="v-table-wrap">
          <table className="v-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>
                  <div>Trust status</div>
                  <div className="v-catalog-th-sub">(agent scored)</div>
                </th>
                <th>
                  <div>Validity window</div>
                  <div className="v-catalog-th-sub">(live countdown)</div>
                </th>
                <th><span className="v-visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {radar.map((row) => (
                <tr key={row.marketId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <AssetLogo asset={row.asset} size={32} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="v-asset-name">{row.title}</span>
                          <span className="v-asset-badge">{row.ticker}</span>
                        </div>
                        <div className="v-cell-sub" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <EnsLogo size={12} />
                          <span>{row.asset.name}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <ColoredScore score={row.score.score} />
                  </td>
                  <td>
                    <ExpiryCountdownBar
                      runAt={row.score.runAt}
                      validityDays={row.score.validityDays}
                      now={now}
                    />
                  </td>
                  <td>
                    <a className="v-btn-detail" href={`/agents/inspect/${encodeURIComponent(row.marketId)}`}>
                      Inspect<ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
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
