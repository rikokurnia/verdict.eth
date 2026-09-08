export type Evidence = { daysRemaining: number; fresh: boolean; revoked: boolean; available: boolean; riskConflict: boolean };
export type VerdictState = 'POLICY_PASS' | 'REVIEW' | 'BLOCKED' | 'UNAVAILABLE';
export function evaluate(e: Evidence): { state: VerdictState; reason: string } {
  if (!e.available) return { state: 'UNAVAILABLE', reason: 'Evidence could not be resolved. No decision is inferred.' };
  if (e.revoked) return { state: 'BLOCKED', reason: 'The asset attestation has been revoked.' };
  if (e.daysRemaining <= 0) return { state: 'BLOCKED', reason: 'The independent audit has expired. A fresh attestation is required.' };
  if (!e.fresh) return { state: 'BLOCKED', reason: 'The risk heartbeat is stale. Fresh evidence is required.' };
  if (e.riskConflict) return { state: 'BLOCKED', reason: 'The risk authority reports conflicting evidence.' };
  if (e.daysRemaining < 14) return { state: 'REVIEW', reason: 'The audit is approaching expiry. Review before proceeding.' };
  return { state: 'POLICY_PASS', reason: 'Audit valid. Risk evidence fresh. The configured policy passes.' };
}
