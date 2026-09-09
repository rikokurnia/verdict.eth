'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import type { VerdictApiResponse } from '@/lib/verdict-types';

type LoadState = 'loading' | 'ready' | 'error';

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAgo(timestamp: number, now: number) {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 90) return `${elapsed}s ago`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ago`;
  if (elapsed < 86_400) return `${Math.floor(elapsed / 3600)}h ago`;
  return `${Math.floor(elapsed / 86_400)}d ago`;
}

function shortHash(value: string | undefined) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—';
}

export default function LifecyclePage() {
  const [live, setLive] = useState<VerdictApiResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');

  const refresh = useCallback(async () => {
    setLoadState('loading');
    try {
      const response = await fetch('/api/verdict', { cache: 'no-store' });
      if (!response.ok) throw new Error('resolver unavailable');
      setLive((await response.json()) as VerdictApiResponse);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const explorer = ENSV2_SEPOLIA.explorer;
  const days = live?.evidence.daysRemaining ?? null;
  const auditStatus = live?.audit?.status ?? null;
  const revoked = live ? live.evidence.revoked : null;
  const now = live?.evaluatedAt ?? Math.floor(Date.now() / 1000);

  const auditChip = !live || loadState !== 'ready'
    ? 'UNAVAILABLE' as const
    : live.state === 'POLICY_PASS' ? 'POLICY_PASS' as const
    : live.state === 'REVIEW' ? 'REVIEW' as const : 'BLOCKED' as const;

  const auditLine = days === null
    ? 'Resolving…'
    : days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days} days remaining`;

  const revocationLine = revoked === null
    ? 'Resolving…'
    : revoked ? `Revoked · ${auditStatus}` : `Active · ${auditStatus} · revocation available`;

  const heartbeatLine = !live || loadState !== 'ready'
    ? 'Resolving…'
    : `${formatAgo(live.observation?.observedAt ?? now, now)} · ${live.evidence.fresh ? 'fresh' : 'STALE'}`;

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

      <div className="v-life-grid">
        <div className="v-card">
          <div className="v-label">Expiring audit · live</div>
          <div style={{ margin: '8px 0' }}><StatusChip state={auditChip} /></div>
          <div style={{ fontSize: 14 }}>{auditLine}</div>
          <div className="v-muted">
            {issuedAt && expiresAt ? `${formatDate(issuedAt)} → ${formatDate(expiresAt)}` : 'Issued → expiry unavailable'}
            {live?.audit?.auditor ? ` · ${live.audit.auditor}` : ''}
          </div>
        </div>
        <div className="v-card">
          <div className="v-label">Revocable tranche · live</div>
          <div style={{ margin: '8px 0' }}><StatusChip state={revoked ? 'BLOCKED' : revoked === false ? 'POLICY_PASS' : 'UNAVAILABLE'} /></div>
          <div style={{ fontSize: 14 }}>{revocationLine}</div>
          <div className="v-muted">Auditor or issuer can revoke · doc {shortHash(live?.audit?.documentHash)}</div>
        </div>
        <div className="v-card">
          <div className="v-label">Risk heartbeat · live</div>
          <div style={{ margin: '8px 0' }}><StatusChip state={live?.evidence.fresh ? 'POLICY_PASS' : loadState === 'ready' ? 'BLOCKED' : 'UNAVAILABLE'} /></div>
          <div style={{ fontSize: 14 }}>{heartbeatLine}</div>
          <div className="v-muted">{live?.observation ? `${live.observation.severity} · ${live.observation.reasonCode}` : 'Monitor observation unavailable'}</div>
        </div>
        <div className="v-card">
          <div className="v-label">Namespace policy · static demo</div>
          <div style={{ margin: '8px 0' }}><StatusChip state="POLICY_PASS" /></div>
          <div style={{ fontSize: 14 }}>Soulbound + forever names configured</div>
          <div className="v-muted">Enforced by EAC roles and registry policy — capability demo, not a verdict.</div>
        </div>
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
            <dt>AI confidence</dt><dd>{live.audit?.ai.confidence ?? '—'}% · {live.audit?.ai.model ?? '—'}</dd>
          </dl>
        </div>
      )}

      <p className="v-muted" style={{ marginTop: 16 }}>
        Three of four states resolve live from independent ENSv2 authorities at a pinned source block.
        The namespace-policy card documents registry capability; it never affects the verdict.
      </p>
    </>
  );
}
