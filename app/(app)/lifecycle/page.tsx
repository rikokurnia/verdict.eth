import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import type { VerdictState } from '@/lib/policy';

const CARDS: { t: string; s: string; st: VerdictState; d: string }[] = [
  { t: 'Expiring audit', s: '27 days remaining', st: 'POLICY_PASS', d: 'Renews via auditor attestation.' },
  { t: 'Revocable tranche', s: 'Active · revocation available', st: 'REVIEW', d: 'Issuer or auditor can revoke.' },
  { t: 'Soulbound KYC', s: 'Transfer disabled', st: 'BLOCKED', d: 'Non-transferable membership.' },
  { t: 'Forever genesis', s: 'No expiry · immutable', st: 'POLICY_PASS', d: 'No parent control.' },
];

export default function LifecyclePage() {
  return (
    <>
      <PageHead title="Lifecycle" sub="Expiry, revocation and permanent states, side by side." />
      <div className="v-life-grid">
        {CARDS.map(({ t, s, st, d }) => (
          <div className="v-card" key={t}>
            <div className="v-label">{t}</div>
            <div style={{ margin: '8px 0' }}><StatusChip state={st} /></div>
            <div style={{ fontSize: 14 }}>{s}</div>
            <div className="v-muted">{d}</div>
          </div>
        ))}
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Timeline</div>
        <div className="v-timeline">
          <div className="v-tick done">Issued ✓</div>
          <div className="v-tick done">Audit ✓</div>
          <div className="v-tick warn">Review window ▲</div>
          <div className="v-tick bad">Expiry ×</div>
        </div>
      </div>
    </>
  );
}
