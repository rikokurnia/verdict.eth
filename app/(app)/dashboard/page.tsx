'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS, DEMO_ACTIVITY } from '@/components/app/demo-data';

export default function DashboardPage() {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const assets = DEMO_ASSETS.filter((a) =>
    !query || a.title.toLowerCase().includes(query) || a.name.includes(query) || a.ticker.toLowerCase().includes(query),
  );
  const pass = DEMO_ASSETS.filter((a) => a.state === 'POLICY_PASS').length;
  const review = DEMO_ASSETS.filter((a) => a.state === 'REVIEW').length;
  const blocked = DEMO_ASSETS.filter((a) => a.state === 'BLOCKED').length;

  return (
    <>
      <PageHead title="Verdict Dashboard" sub="Live trust state across ENS-bound assets." />
      <input className="v-search-big" placeholder="Search asset or ENS name…" aria-label="Search assets" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="v-grid v-cards-4" style={{ marginTop: 20 }}>
        {[
          ['Total assets', String(DEMO_ASSETS.length), 'demo set'],
          ['Policy pass', String(pass), 'fresh evidence'],
          ['Need review', String(review), 'expiry < 14d'],
          ['Blocked', String(blocked), 'expired / revoked'],
        ].map(([l, v, s]) => (
          <div className="v-card" key={l}>
            <div className="v-label">{l}</div>
            <div className="v-metric">{v}</div>
            <div className="v-muted">{s}</div>
          </div>
        ))}
      </div>
      <div className="v-split">
        <div className="v-card">
          <h3 className="v-section-title">Asset Verdicts</h3>
          <p className="v-muted">Deterministic verdict per asset. Always paired with reasons.</p>
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr><th>Asset</th><th>Verdict</th><th>Audit</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.name}>
                    <td>
                      <Link className="v-rowlink" href={`/assets/${encodeURIComponent(a.name)}`}>
                        <div className="v-asset-name">{a.title}</div>
                        <div className="v-asset-sub">{a.name}</div>
                      </Link>
                    </td>
                    <td><StatusChip state={a.state} /></td>
                    <td style={{ fontSize: 13 }}>{a.auditNote}</td>
                    <td style={{ fontSize: 13 }}>{a.riskNote}</td>
                  </tr>
                ))}
                {!assets.length && (
                  <tr><td colSpan={4} className="v-muted">No assets resolved yet. Try another name.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="v-card">
          <h3 className="v-section-title">Authority Health</h3>
          <div className="v-health-row"><span>Issuer · acme.verdict.eth</span><span className="v-ok"><CheckCircle2 size={15} />Healthy</span></div>
          <div className="v-health-row"><span>Auditor · audit-001.auditor.eth</span><span className="v-warn"><AlertTriangle size={15} />1 expiring</span></div>
          <div className="v-health-row"><span>Risk monitor</span><span className="v-bad"><XCircle size={15} />1 stale</span></div>
        </div>
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <h3 className="v-section-title">Recent Activity</h3>
        {DEMO_ACTIVITY.map((e) => (
          <div className="v-activity-item" key={e.tx}>
            <strong style={{ fontSize: 12, letterSpacing: '.06em' }}>{e.label}</strong>
            <div style={{ fontSize: 14 }}>{e.text}</div>
            <div className="v-activity-meta"><span>{e.time}</span><span className="v-mono">{e.tx} ↗</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
