import { PageHead } from '@/components/app/app-shell';

const ROWS = [
  { record: 'issuer', issuer: 'Edit', auditor: '—', risk: '—' },
  { record: 'ticker', issuer: 'Edit', auditor: '—', risk: '—' },
  { record: 'audit-hash', issuer: 'Blocked', auditor: 'Edit', risk: '—' },
  { record: 'audit-expiry', issuer: 'Blocked', auditor: 'Edit', risk: '—' },
  { record: 'heartbeat', issuer: 'Blocked', auditor: '—', risk: 'Edit' },
];

export default function AuthoritiesPage() {
  return (
    <>
      <PageHead title="Authorities" sub="Who controls what — and what happens on unauthorized writes." />
      <div className="v-grid v-authority-cards">
        {[
          ['Issuer', 'acme.verdict.eth', ['issuer', 'ticker', 'asset-class', 'docs-contenthash'], ['audit-*', 'risk-*']],
          ['Auditor', 'audit-001.auditor.eth', ['audit-hash', 'audit-expiry'], ['asset facts', 'policy']],
          ['Risk engine', 'risk.*', ['heartbeat'], ['attestation', 'policy']],
        ].map(([t, n, can, cannot]) => (
          <div className="v-card" key={t as string}>
            <div className="v-label">{t}</div>
            <div className="v-mono" style={{ margin: '6px 0 12px' }}>{n}</div>
            <div className="v-label">Can update</div>
            <div style={{ fontSize: 13, margin: '4px 0 10px' }}>{(can as string[]).join(' · ')}</div>
            <div className="v-label">Cannot update</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{(cannot as string[]).join(' · ')}</div>
          </div>
        ))}
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Permission matrix</div>
        <div className="v-table-wrap">
          <table className="v-table">
            <thead><tr><th>Record</th><th>Issuer</th><th>Auditor</th><th>Risk engine</th></tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.record} className="v-asset-row">
                  <td className="v-mono">{r.record}</td><td>{r.issuer}</td><td>{r.auditor}</td><td>{r.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="v-dark" style={{ marginTop: 16 }}>
        <div className="v-label">Unauthorized write demo</div>
        <p>Issuer → SET_TEXT:audit-hash</p>
        <p className="v-dark-fail">BLOCKED BY PERMISSIONED RESOLVER — transaction reverted</p>
        <p style={{ color: 'var(--on-dark-muted)' }}>[View transaction] · wires to live tx in contract phase</p>
      </div>
    </>
  );
}
