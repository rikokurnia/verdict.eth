import { PageHead } from '@/components/app/app-shell';

export default function DashboardStub() {
  return (
    <>
      <PageHead title="Overview" sub="Live trust state across ENS-bound assets." />
      <div className="v-grid v-cards-4">
        {[['Total assets', '4', 'demo set'], ['Policy pass', '2', 'fresh evidence'], ['Need review', '1', 'expiry < 14d'], ['Blocked', '1', 'expired / revoked']].map(([l, v, s]) => (
          <div className="v-card" key={l}>
            <div className="v-label">{l}</div>
            <div className="v-metric">{v}</div>
            <div className="v-muted">{s}</div>
          </div>
        ))}
      </div>
      <p className="v-muted" style={{ marginTop: 24 }}>Phase 1 shell. Overview content lands in Phase 2.</p>
    </>
  );
}
