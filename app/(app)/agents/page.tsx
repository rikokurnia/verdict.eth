import { PageHead } from '@/components/app/app-shell';

const STEPS = ['Agent', 'ENS Name', 'Resolver', 'Issuer + Auditor + Risk Records', 'Deterministic Policy', 'POLICY_PASS / REVIEW / BLOCKED / UNAVAILABLE'];

export default function AgentsPage() {
  return (
    <>
      <PageHead title="Agents" sub="ENS is machine-readable infrastructure, not merely human identity." />
      <div className="v-split">
        <div className="v-card">
          <div className="v-label">Rebalancer agent</div>
          <div className="v-mono" style={{ margin: '6px 0 12px' }}>rebalancer.usd-yield-001.acme.verdict.eth</div>
          <dl className="v-kv">
            <dt>Status</dt><dd>Online</dd>
            <dt>Context</dt><dd>Portfolio suitability</dd>
            <dt>Protocol</dt><dd>ENSIP-25 / ENSIP-26</dd>
            <dt>Endpoint</dt><dd>MCP</dd>
            <dt>Last resolution</dt><dd>11s ago</dd>
          </dl>
        </div>
        <div className="v-card">
          <div className="v-label">Query simulation</div>
          <div className="v-cli" style={{ marginTop: 10 }}>
            <div><span className="v-dim">$</span> suitable usd-yield-001.acme.verdict.eth</div>
            <div>Resolving identity… <span className="v-pass-t">✓</span></div>
            <div>Reading auditor authority… <span className="v-pass-t">✓</span></div>
            <div>Checking expiry… <span className="v-pass-t">✓</span></div>
            <div>Checking heartbeat… <span className="v-pass-t">✓</span></div>
            <div><span className="v-pass-t">POLICY_PASS</span></div>
          </div>
        </div>
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Resolution flow</div>
        <div className="v-flow" role="img" aria-label="Agent resolves ENS name through resolver to records to policy to verdict">
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: 'contents' }}>
              <span className="v-step"><strong>{String(i + 1).padStart(2, '0')}</strong>{s}</span>
              {i < STEPS.length - 1 && <span className="v-step-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>Live agent reads wire up in contract phase. Same policy evaluator as the web UI — no server-trusted verdict.</p>
    </>
  );
}
