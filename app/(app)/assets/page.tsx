'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import type { VerdictState } from '@/lib/policy';

export default function AssetsPage() {
  const [q, setQ] = useState('');
  const [state, setState] = useState<'ALL' | VerdictState>('ALL');
  const [cls, setCls] = useState('ALL');
  const query = q.trim().toLowerCase();
  const rows = DEMO_ASSETS.filter((a) =>
    (!query || a.title.toLowerCase().includes(query) || a.name.includes(query) || a.ticker.toLowerCase().includes(query)) &&
    (state === 'ALL' || a.state === state) &&
    (cls === 'ALL' || a.assetClass === cls),
  );

  return (
    <>
      <PageHead title="Assets" sub="Canonical ENS identities and their current deterministic verdict." />
      <div className="v-filters">
        <input className="v-search-big" style={{ maxWidth: 360 }} placeholder="Search ENS / ticker" aria-label="Search assets" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="v-select" aria-label="Filter by state" value={state} onChange={(e) => setState(e.target.value as 'ALL' | VerdictState)}>
          <option value="ALL">All states</option>
          <option value="POLICY_PASS">Policy pass</option>
          <option value="REVIEW">Review</option>
          <option value="BLOCKED">Blocked</option>
          <option value="UNAVAILABLE">Unavailable</option>
        </select>
        <select className="v-select" aria-label="Filter by asset class" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="ALL">All classes</option>
          <option value="Yield">Yield</option>
          <option value="Bond">Bond</option>
          <option value="Treasury">Treasury</option>
        </select>
      </div>
      <div className="v-card">
        <div className="v-table-wrap">
          <table className="v-table">
            <thead>
              <tr><th>Asset</th><th>Verdict</th><th>Issuer</th><th>Audit</th><th>Risk</th><th>Heartbeat</th><th>Network</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.name} className="v-asset-row">
                  <td>
                    <Link className="v-rowlink" href={`/assets/${encodeURIComponent(a.name)}`}>
                      <div className="v-asset-name">{a.title}</div>
                      <div className="v-asset-sub">{a.name}</div>
                    </Link>
                  </td>
                  <td><StatusChip state={a.state} /></td>
                  <td style={{ fontSize: 13 }}>{a.issuer}</td>
                  <td style={{ fontSize: 13 }}>{a.auditNote}</td>
                  <td style={{ fontSize: 13 }}>{a.riskNote}</td>
                  <td style={{ fontSize: 13 }}>{a.heartbeat}</td>
                  <td style={{ fontSize: 13 }}>{a.network}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={7} className="v-muted">No assets match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
