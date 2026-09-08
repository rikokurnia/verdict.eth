import { CheckCircle2, AlertTriangle, XCircle, Unplug } from 'lucide-react';
import type { VerdictState } from '@/lib/policy';

const MAP: Record<VerdictState, { cls: string; label: string; Icon: typeof CheckCircle2 }> = {
  POLICY_PASS: { cls: 'v-chip-pass', label: 'POLICY_PASS', Icon: CheckCircle2 },
  REVIEW: { cls: 'v-chip-review', label: 'REVIEW', Icon: AlertTriangle },
  BLOCKED: { cls: 'v-chip-blocked', label: 'BLOCKED', Icon: XCircle },
  UNAVAILABLE: { cls: 'v-chip-unavailable', label: 'UNAVAILABLE', Icon: Unplug },
};

export default function StatusChip({ state }: { state: VerdictState }) {
  const { cls, label, Icon } = MAP[state];
  return (
    <span className={'v-chip ' + cls}>
      <Icon aria-hidden />{label}
    </span>
  );
}
