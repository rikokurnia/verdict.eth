import { PageHead } from '@/components/app/app-shell';
import { DEMO_ACTIVITY } from '@/components/app/demo-data';

const EXTRA = [
  { label: 'HEARTBEAT UPDATED', text: 'Risk monitor refreshed heartbeat for usd-yield-001', time: '2 min ago', tx: '0x44a…9c0' },
  { label: 'AUTHORITY GRANTED', text: 'SET_TEXT:audit-* granted to audit-001.auditor.eth', time: '1 h ago', tx: '0xb71…3f2' },
  { label: 'ALIAS RESOLVED', text: 'arb.usd-yield-001 → canonical asset profile', time: '3 h ago', tx: '0x08e…d51' },
];

export default function ActivityPage() {
  return (
    <>
      <PageHead title="Activity" sub="Audit trail — every write, revert and state transition." />
      <div className="v-card">
        {[...DEMO_ACTIVITY, ...EXTRA].map((e) => (
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
