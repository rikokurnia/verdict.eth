'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Unplug } from 'lucide-react';
import StatusChip from '@/components/app/status-chip';
import { ToastStack, useToasts } from '@/components/app/toast';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { evaluate, type Evidence, type VerdictState } from '@/lib/policy';

type Scenario = 'live' | 'expiring' | 'expired' | 'offline';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'expiring', label: 'Expiring → review' },
  { id: 'expired', label: 'Expired → blocked' },
  { id: 'offline', label: 'Resolver offline' },
];

const BASE_EVIDENCE: Record<string, Evidence> = {
  'usd-yield-001.acme.verdict.eth': { daysRemaining: 27, fresh: true, revoked: false, available: true, riskConflict: false },
  'usd-yield-002.acme.verdict.eth': { daysRemaining: 7, fresh: true, revoked: false, available: true, riskConflict: false },
  'eur-bond-003.acme.verdict.eth': { daysRemaining: 0, fresh: false, revoked: false, available: true, riskConflict: false },
  'us-tbill-004.acme.verdict.eth': { daysRemaining: 40, fresh: true, revoked: true, available: true, riskConflict: true },
};

const DETAIL: Record<VerdictState, { ok: string[]; bad: string[]; warn: string[] }> = {
  POLICY_PASS: { ok: ['Audit is valid', 'Risk signal is fresh', 'Heartbeat is fresh'], bad: [], warn: [] },
  REVIEW: { ok: ['Risk signal is fresh', 'Heartbeat is fresh'], bad: [], warn: ['Audit approaching expiry — review required'] },
  BLOCKED: { ok: ['ENS resolution successful'], bad: ['Blocking evidence active — see reason'], warn: [] },
  UNAVAILABLE: { ok: [], bad: [], warn: [] },
};

const VERDICT_CLS: Record<VerdictState, string> = {
  POLICY_PASS: 'v-verdict-pass', REVIEW: 'v-verdict-review',
  BLOCKED: 'v-verdict-blocked', UNAVAILABLE: 'v-verdict-unavailable',
};

const TOAST_KIND = { POLICY_PASS: 'pass', REVIEW: 'review', BLOCKED: 'blocked', UNAVAILABLE: 'info' } as const;

export default function AssetDetailPage({ params }: { params: { name: string } }) {
  const [scenario, setScenario] = useState<Scenario>('live');
  const [copied, setCopied] = useState(false);
  const { toasts, push } = useToasts();
  const name = decodeURIComponent(params.name);
  const asset = DEMO_ASSETS.find((a) => a.name === name) ?? DEMO_ASSETS[0];

  const base = BASE_EVIDENCE[asset.name] ?? BASE_EVIDENCE[DEMO_ASSETS[0].name];
  const evidence: Evidence =
    scenario === 'live' ? base :
    scenario === 'expiring' ? { ...base, daysRemaining: 7, revoked: false, available: true } :
    scenario === 'expired' ? { ...base, daysRemaining: 0, available: true } :
    { ...base, available: false };
  const result = evaluate(evidence);
  const detail = DETAIL[result.state];

  function pick(id: Scenario, label: string) {
    setScenario(id);
    if (id !== 'live') push(TOAST_KIND[evaluate(
      id === 'expiring' ? { ...base, daysRemaining: 7, revoked: false, available: true } :
      id === 'expired' ? { ...base, daysRemaining: 0, available: true } :
      { ...base, available: false },
    ).state], 'Scenario: ' + label, evaluate(
      id === 'expiring' ? { ...base, daysRemaining: 7, revoked: false, available: true } :
      id === 'expired' ? { ...base, daysRemaining: 0, available: true } :
      { ...base, available: false },
    ).reason);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(asset.name); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  }

  return (
    <>
      <div className="v-asset-head">
        <div>
          <h2>{asset.title}</h2>
          <div className="v-ensline">
            <span>{asset.name}</span>
            <button className="v-copy-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
            <span>Ticker {asset.ticker}</span>
          </div>
        </div>
      </div>
      <div className="v-scenarios" role="group" aria-label="Demo scenarios">
        {SCENARIOS.map((s) => (
          <button key={s.id} className="v-scen" aria-pressed={scenario === s.id} onClick={() => pick(s.id, s.label)}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}><StatusChip state={result.state} /></div>
      <div className="v-split">
        <div className={'v-verdict ' + VERDICT_CLS[result.state]}>
          <div className="v-label">Verdict</div>
          <h3>{result.state.replace('_', ' ')}</h3>
          <p style={{ fontSize: 14, margin: '0 0 10px' }}>{result.reason}</p>
          <ul>
            {detail.ok.map((r) => <li key={r}><CheckCircle2 size={16} />{r}</li>)}
            {detail.warn.map((r) => <li key={r}><AlertTriangle size={16} />{r}</li>)}
            {detail.bad.map((r) => <li key={r}><XCircle size={16} />{r}</li>)}
            {result.state === 'UNAVAILABLE' && <li><Unplug size={16} />Resolver request failed — no decision inferred.</li>}
          </ul>
          <p className="v-muted" style={{ marginTop: 12 }}>Evaluated just now · policy v0</p>
        </div>
        <div className="v-card">
          <div className="v-label">Asset</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Ticker</dt><dd className="v-mono">{asset.ticker}</dd>
            <dt>Class</dt><dd>{asset.assetClass}</dd>
            <dt>Issuer</dt><dd>{asset.issuer}</dd>
            <dt>Network</dt><dd>{asset.network}</dd>
          </dl>
        </div>
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Authority graph</div>
        <div className="v-graph" role="img" aria-label={`Issuer, auditor and risk authorities resolve to ${asset.title}`}>
          <div className="v-node"><strong>Issuer</strong>acme.verdict.eth</div>
          <div className="v-edge"><span>audit-*</span></div>
          <div className="v-node v-node-center"><strong>Asset</strong>{asset.ticker}</div>
          <div className="v-edge"><span>risk-*</span></div>
          <div className="v-node"><strong>Auditor</strong>audit-001.auditor.eth</div>
        </div>
      </div>
      <div className="v-split">
        <div className="v-card">
          <div className="v-label">ENS records</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>issuer</dt><dd className="v-mono">acme.verdict.eth</dd>
            <dt>CLASS</dt><dd className="v-mono">{asset.assetClass.toLowerCase()}</dd>
            <dt>audit-hash</dt><dd className="v-mono">sha256:89a…</dd>
            <dt>audit-expiry</dt><dd className="v-mono">{asset.auditNote}</dd>
            <dt>heartbeat</dt><dd className="v-mono">{asset.heartbeat}</dd>
            <dt>agent-context</dt><dd className="v-mono">portfolio suitability</dd>
          </dl>
        </div>
        <div className="v-card">
          <div className="v-label">Lifecycle</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Audit expiry</dt><dd>{asset.auditNote}</dd>
            <dt>Revocable</dt><dd>{asset.name.includes('tbill') ? 'Revoked by auditor' : 'Active'}</dd>
            <dt>Transfer</dt><dd>Soulbound tranche disabled</dd>
            <dt>Genesis</dt><dd>No expiry</dd>
          </dl>
        </div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>
        <Unplug size={13} style={{ verticalAlign: -2 }} /> Live Sepolia resolution, permission proofs and transactions wire up in contract phase. Current values are labeled demo data.
      </p>
      <ToastStack toasts={toasts} />
    </>
  );
}
