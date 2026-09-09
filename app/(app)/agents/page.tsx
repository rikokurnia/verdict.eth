import { PageHead } from '@/components/app/app-shell';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { resolveVerdict } from '@/lib/verdict-service';

const STEPS = ['Agent', 'ENS Name', 'Resolver', 'Issuer + Auditor + Risk Records', 'Deterministic Policy', 'POLICY_PASS / REVIEW / BLOCKED / UNAVAILABLE'];

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const result = await resolveVerdict();
  const ai = result.audit?.ai;
  const explorer = ENSV2_SEPOLIA.explorer;
  return (
    <>
      <PageHead title="Agents" sub="ENS is machine-readable infrastructure, not merely human identity." />
      <div className="v-split">
        <div className="v-card">
          <div className="v-label">AI evidence agent</div>
          <div className="v-mono" style={{ margin: '6px 0 12px' }}>treasury-agent.verdict.eth</div>
          <dl className="v-kv">
            <dt>Status</dt><dd>{result.ok ? 'Onchain result verified' : 'Unavailable'}</dd>
            <dt>Model</dt><dd>{ai?.model || '—'}</dd>
            <dt>Confidence cap</dt><dd>{ai ? `${ai.confidence}%` : '—'}</dd>
            <dt>Evidence hash</dt><dd className="v-mono">{ai?.sourceHash ? `${ai.sourceHash.slice(0, 14)}…${ai.sourceHash.slice(-8)}` : '—'}</dd>
            <dt>Network</dt><dd>Sepolia · 11155111</dd>
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
            <div><span className="v-pass-t">{result.state}</span></div>
            <div className="v-dim">{result.observation?.reasonCode}</div>
          </div>
        </div>
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Last autonomous audit</div>
        <p style={{ margin: '10px 0' }}>{ai?.rationale || 'No AI audit rationale is available.'}</p>
        <div className="v-mono" style={{ fontSize: 12 }}>
          <a href={`${explorer}/tx/${ENSV2_SEPOLIA.transactions.aiAudit}`} target="_blank" rel="noreferrer">Auditor write ↗</a>
          {' · '}
          <a href={`${explorer}/tx/${ENSV2_SEPOLIA.transactions.aiObservation}`} target="_blank" rel="noreferrer">Monitor write ↗</a>
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
      <p className="v-muted" style={{ marginTop: 16 }}>The agent and web UI read the same ENSv2 evidence graph and deterministic policy. The API signs nothing and holds no custody key.</p>
    </>
  );
}
