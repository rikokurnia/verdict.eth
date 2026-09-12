'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Unplug, XCircle } from 'lucide-react';
import StatusChip from '@/components/app/status-chip';
import { ToastStack, useToasts } from '@/components/app/toast';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { OfficialDeployments } from '@/components/app/asset-identity';
import { ENSV2_SEPOLIA, ENS_EXPLORER_NAME_URL } from '@/lib/ensv2-config';
import type { EnsProfile } from '@/lib/ens-profile';
import { evaluate, type Evidence, type VerdictState } from '@/lib/policy';
import type { VerdictApiResponse } from '@/lib/verdict-types';

type Scenario = 'live' | 'expiring' | 'expired' | 'offline';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'live', label: 'Live Sepolia' },
  { id: 'expiring', label: 'Expiring → review' },
  { id: 'expired', label: 'Expired → blocked' },
  { id: 'offline', label: 'Resolver offline' },
];

const UNAVAILABLE: Evidence = {
  daysRemaining: 0,
  fresh: false,
  revoked: false,
  available: false,
  riskConflict: false,
};

const DETAIL: Record<VerdictState, { ok: string[]; bad: string[]; warn: string[] }> = {
  POLICY_PASS: { ok: ['Independent audit is active', 'Risk observation is fresh', 'Evidence subjects match the asset'], bad: [], warn: [] },
  REVIEW: { ok: ['Risk observation is fresh', 'Evidence subjects match the asset'], bad: [], warn: ['Audit is approaching expiry — review required'] },
  BLOCKED: { ok: ['ENS resolution successful'], bad: ['Blocking evidence is active — see reason'], warn: [] },
  UNAVAILABLE: { ok: [], bad: [], warn: [] },
};

const VERDICT_CLS: Record<VerdictState, string> = {
  POLICY_PASS: 'v-verdict-pass',
  REVIEW: 'v-verdict-review',
  BLOCKED: 'v-verdict-blocked',
  UNAVAILABLE: 'v-verdict-unavailable',
};

const TOAST_KIND = { POLICY_PASS: 'pass', REVIEW: 'review', BLOCKED: 'blocked', UNAVAILABLE: 'info' } as const;

function shortHash(value: string | undefined) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—';
}

function dateTime(timestamp: number | undefined) {
  return timestamp ? new Date(timestamp * 1000).toLocaleString() : '—';
}

export default function AssetDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const [scenario, setScenario] = useState<Scenario>('live');
  const [copied, setCopied] = useState(false);
  const [live, setLive] = useState<VerdictApiResponse | null>(null);
  const [profile, setProfile] = useState<EnsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toasts, push } = useToasts();
  const { name } = use(params);
  const decodedName = decodeURIComponent(name).toLowerCase();
  const fallback = DEMO_ASSETS.find((asset) => asset.name === decodedName) ?? DEMO_ASSETS[0];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/verdict?name=${encodeURIComponent(decodedName)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Verdict source unavailable');
        const result = await response.json() as VerdictApiResponse;
        if (!result.asset || !result.state || !result.evidence) throw new Error('Invalid verdict response');
        setLive(result);
      })
      .catch(() => setLive(null))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [decodedName]);

  // Registry profiles (rwa.*) carry identity records, not verdict evidence.
  // When no verdict resolves, show the live onchain profile as proof instead.
  useEffect(() => {
    if (loading || live || !decodedName.endsWith('.rwa.verdict.eth')) return;
    const controller = new AbortController();
    fetch(`/api/profile?name=${encodeURIComponent(decodedName)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as EnsProfile;
        if (result.ok) setProfile(result);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [loading, live, decodedName]);

  const base = live?.evidence ?? UNAVAILABLE;
  const simulatedEvidence = useMemo<Evidence>(() => (
    scenario === 'expiring' ? { ...base, daysRemaining: 7, revoked: false, available: true } :
    scenario === 'expired' ? { ...base, daysRemaining: 0, revoked: false, available: true } :
    scenario === 'offline' ? UNAVAILABLE :
    base
  ), [base, scenario]);
  const result = scenario === 'live' && live
    ? { state: live.state, reason: live.reason }
    : evaluate(simulatedEvidence);
  const detail = DETAIL[result.state];

  const display = {
    title: live?.asset?.displayName ?? profile?.records['verdict.asset.displayName'] ?? fallback.title,
    ticker: live?.asset?.ticker ?? profile?.records['verdict.asset.ticker'] ?? fallback.ticker,
    assetClass: live?.asset?.assetClass ?? profile?.records['verdict.asset.class'] ?? fallback.assetClass,
    issuer: live?.asset?.issuer ?? profile?.records['verdict.asset.issuer'] ?? fallback.issuer,
    network: live ? `Sepolia · chain ${live.chainId}` : fallback.network,
  };
  const profileMode = !loading && !live && profile !== null;
  const assetRecords = live?.sources.find((source) => source.name === decodedName)?.records;

  function pick(id: Scenario, label: string) {
    setScenario(id);
    if (id === 'live') return;
    const evidence = id === 'expiring'
      ? { ...base, daysRemaining: 7, revoked: false, available: true }
      : id === 'expired'
        ? { ...base, daysRemaining: 0, revoked: false, available: true }
        : UNAVAILABLE;
    const simulated = evaluate(evidence);
    push(TOAST_KIND[simulated.state], `Scenario: ${label}`, simulated.reason);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(decodedName);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* Clipboard access is optional. */ }
  }

  return (
    <>
      <div className="v-asset-head">
        <div>
          <h2>{display.title}</h2>
          <div className="v-ensline">
            <span>{decodedName}</span>
            <button className="v-copy-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            {decodedName.endsWith('.eth') && (
              <a
                className="v-copy-btn"
                href={ENS_EXPLORER_NAME_URL(decodedName)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${decodedName} on app.ens.domains`}
                title={`Open ${decodedName} on app.ens.domains`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
              >
                <span>ENS</span>
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
            <span>Ticker {display.ticker}</span>
            {live?.aliasedFrom && <span>Alias → {live.resolvedName}</span>}
          </div>
        </div>
      </div>

      <div className="v-scenarios" role="group" aria-label="Verdict scenarios">
        {SCENARIOS.map((item) => (
          <button key={item.id} className="v-scen" aria-pressed={scenario === item.id} onClick={() => pick(item.id, item.label)}>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <StatusChip state={loading && scenario === 'live' ? 'UNAVAILABLE' : result.state} />
        {loading && scenario === 'live' && <span className="v-muted" style={{ marginLeft: 10 }}>Resolving pinned Sepolia state…</span>}
        {profileMode && <span className="v-muted" style={{ marginLeft: 10 }}>Registry profile — identity evidence, not a verdict.</span>}
      </div>

      {profileMode && profile ? (
        <div className="v-card">
          <div className="v-label">Onchain ENS proof · {profile.name}</div>
          <p style={{ fontSize: 14, margin: '10px 0' }}>
            {profile.records['verdict.profile.authority'] ?? ''} — every row below resolved live from Sepolia at block {profile.sourceBlock}.
          </p>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            {Object.entries(profile.records).filter(([, v]) => v).map(([key, value]) => (
              <div key={key} style={{ display: 'contents' }}>
                <dt>{key}</dt><dd className="v-mono" style={{ overflowWrap: 'anywhere' }}>{value}</dd>
              </div>
            ))}
            <dt>Resolver</dt><dd className="v-mono"><a href={`${ENSV2_SEPOLIA.explorer}/address/${profile.resolver}`} target="_blank" rel="noreferrer">{shortHash(profile.resolver)} ↗</a></dd>
            {profile.registration && (
              <>
                <dt>Registration</dt><dd>{profile.registration.statusLabel} · owner <span className="v-mono">{shortHash(profile.registration.owner)}</span></dd>
                <dt>Expiry</dt><dd>{new Date(profile.registration.expiry * 1000).toLocaleDateString()} · token <span className="v-mono">{shortHash(profile.registration.tokenId)}</span></dd>
              </>
            )}
          </dl>
        </div>
      ) : (
      <div className="v-split">
        <div className={`v-verdict ${VERDICT_CLS[result.state]}`}>
          <div className="v-label">{scenario === 'live' ? 'Live on-chain verdict' : 'Local policy simulation'}</div>
          <h3>{result.state.replace('_', ' ')}</h3>
          <p style={{ fontSize: 14, margin: '0 0 10px' }}>{result.reason}</p>
          <ul>
            {detail.ok.map((row) => <li key={row}><CheckCircle2 size={16} />{row}</li>)}
            {detail.warn.map((row) => <li key={row}><AlertTriangle size={16} />{row}</li>)}
            {detail.bad.map((row) => <li key={row}><XCircle size={16} />{row}</li>)}
            {result.state === 'UNAVAILABLE' && <li><Unplug size={16} />No decision is inferred from missing evidence.</li>}
          </ul>
          <p className="v-muted" style={{ marginTop: 12 }}>
            {live?.sourceBlock ? `Pinned block ${live.sourceBlock} · ${live.policyId}` : 'Waiting for a verified source block'}
          </p>
        </div>
        <div className="v-card">
          <div className="v-label">Asset</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Ticker</dt><dd className="v-mono">{display.ticker}</dd>
            <dt>Class</dt><dd>{display.assetClass}</dd>
            <dt>Issuer</dt><dd>{display.issuer}</dd>
            <dt>Deployments</dt>
            <dd>
              <OfficialDeployments
                asset={fallback}
                profile={profile}
                liveDeployment={live?.asset?.deployment}
                onCopyToast={(netLabel) => {
                  push('info', 'Address Copied', `${netLabel} contract address copied to clipboard.`);
                }}
              />
            </dd>
          </dl>
        </div>
      </div>
      )}

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Independent authority graph</div>
        <div className="v-graph" role="img" aria-label={`Issuer, auditor and risk authorities resolve to ${display.title}`}>
          <div className="v-node"><strong>Issuer</strong>{display.issuer}</div>
          <div className="v-edge"><span>asset</span></div>
          <div className="v-node v-node-center"><strong>Asset</strong>{display.ticker}</div>
          <div className="v-edge"><span>evidence</span></div>
          <div className="v-node"><strong>Auditor + monitor</strong>{live?.audit?.name ?? '—'}<br />{live?.observation?.name ?? '—'}</div>
        </div>
      </div>

      <div className="v-split">
        <div className="v-card">
          <div className="v-label">Resolved ENS records</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>issuer</dt><dd className="v-mono">{display.issuer}</dd>
            <dt>class</dt><dd className="v-mono">{display.assetClass}</dd>
            <dt>audit</dt><dd className="v-mono">{live?.audit?.name ?? '—'}</dd>
            <dt>audit-hash</dt><dd className="v-mono">{shortHash(live?.audit?.documentHash)}</dd>
            <dt>risk</dt><dd className="v-mono">{live?.observation?.name ?? '—'}</dd>
            <dt>reason</dt><dd className="v-mono">{live?.observation?.reasonCode ?? '—'}</dd>
            <dt>schema</dt><dd className="v-mono">{assetRecords?.['verdict.schema'] ?? '—'}</dd>
          </dl>
        </div>
        <div className="v-card">
          <div className="v-label">Lifecycle</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Audit issued</dt><dd>{dateTime(live?.audit?.issuedAt)}</dd>
            <dt>Audit expiry</dt><dd>{dateTime(live?.audit?.expiresAt)}</dd>
            <dt>Audit status</dt><dd>{live?.audit?.status ?? '—'}</dd>
            <dt>Observed</dt><dd>{dateTime(live?.observation?.observedAt)}</dd>
            <dt>Risk status</dt><dd>{live?.observation?.status ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <p className="v-muted" style={{ marginTop: 16 }}>
        <CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Live data is resolved through the dedicated ENSv2 Sepolia Universal Resolver. Scenario buttons alter only local policy inputs; they never mutate chain state.
      </p>
      <ToastStack toasts={toasts} />
    </>
  );
}
