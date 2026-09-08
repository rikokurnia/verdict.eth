'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Unplug } from 'lucide-react';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS } from '@/components/app/demo-data';

const REASONS: Record<string, { ok: string[]; bad: string[]; warn: string[] }> = {
  'usd-yield-001.acme.verdict.eth': {
    ok: ['Audit is valid (27d remaining)', 'Risk signal is fresh', 'Heartbeat is fresh'],
    bad: [], warn: [],
  },
  'usd-yield-002.acme.verdict.eth': {
    ok: ['Risk signal is fresh', 'Heartbeat is fresh'],
    bad: [], warn: ['Audit expires in 7 days — review required'],
  },
  'eur-bond-003.acme.verdict.eth': {
    ok: ['ENS resolution successful'],
    bad: ['Audit expired 14m ago', 'Risk heartbeat is stale'], warn: [],
  },
  'us-tbill-004.acme.verdict.eth': {
    ok: ['ENS resolution successful'],
    bad: ['Attestation revoked by auditor', 'Risk reports conflicting evidence'], warn: [],
  },
};

const VERDICT_CLS: Record<string, string> = {
  POLICY_PASS: 'v-verdict-pass', REVIEW: 'v-verdict-review',
  BLOCKED: 'v-verdict-blocked', UNAVAILABLE: 'v-verdict-unavailable',
};

export default function AssetDetailPage({ params }: { params: { name: string } }) {
  const [copied, setCopied] = useState(false);
  const name = decodeURIComponent(params.name);
  const asset = DEMO_ASSETS.find((a) => a.name === name) ?? DEMO_ASSETS[0];
  const reasons = REASONS[asset.name] ?? { ok: [], bad: [], warn: [] };
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
      <div style={{ marginBottom: 16 }}><StatusChip state={asset.state} /></div>
      <div className="v-split">
        <div className={'v-verdict ' + (VERDICT_CLS[asset.state] ?? '')}>
          <div className="v-label">Verdict</div>
          <h3>{asset.state.replace('_', ' ')}</h3>
          <ul>
            {reasons.ok.map((r) => <li key={r}><CheckCircle2 size={16} />{r}</li>)}
            {reasons.warn.map((r) => <li key={r}><AlertTriangle size={16} />{r}</li>)}
            {reasons.bad.map((r) => <li key={r}><XCircle size={16} />{r}</li>)}
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
            <dt>Revocable</dt><dd>{asset.state === 'BLOCKED' && asset.name.includes('tbill') ? 'Revoked by auditor' : 'Active'}</dd>
            <dt>Transfer</dt><dd>Soulbound tranche disabled</dd>
            <dt>Genesis</dt><dd>No expiry</dd>
          </dl>
        </div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>
        <Unplug size={13} style={{ verticalAlign: -2 }} /> Live Sepolia resolution, permission proofs and transactions wire up in contract phase. Current values are labeled demo data.
      </p>
    </>
  );
}
