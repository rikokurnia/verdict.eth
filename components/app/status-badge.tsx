import type { CoverageTier } from './demo-data';

export type UnifiedVerdict = 'VERIFIED' | 'REVIEW' | 'BLOCKED' | 'UNAUDITED';

export function getUnifiedVerdict(value?: string | null): UnifiedVerdict {
  if (!value) return 'UNAUDITED';
  const norm = value.toUpperCase().trim();
  if (
    norm === 'PASS' ||
    norm === 'POLICY_PASS' ||
    norm === 'VERIFIED' ||
    norm === 'ACTIVE'
  ) {
    return 'VERIFIED';
  }
  if (norm === 'WARN' || norm === 'REVIEW') {
    return 'REVIEW';
  }
  if (
    norm === 'FAIL' ||
    norm === 'BLOCKED' ||
    norm === 'REVOKED' ||
    norm === 'CRITICAL'
  ) {
    return 'BLOCKED';
  }
  return 'UNAUDITED';
}

export function getAssetVerdict(
  asset: { coverage: CoverageTier; state?: string | null },
  score?: { status?: string } | null,
): UnifiedVerdict {
  if (asset.coverage === 'POLICY_VERIFIED') {
    return getUnifiedVerdict(asset.state);
  }
  if (asset.coverage === 'CONSENSUS_SCORED') {
    if (!score?.status) return 'UNAUDITED';
    return getUnifiedVerdict(score.status);
  }
  return 'UNAUDITED';
}

export const VERDICT_DISPLAY_NAMES: Record<UnifiedVerdict, string> = {
  VERIFIED: 'LOW RISK',
  REVIEW: 'MODERATE RISK',
  BLOCKED: 'HIGH RISK',
  UNAUDITED: 'UNAUDITED',
};

export function StatusBadge({
  status,
  size = 'md',
  className = '',
}: {
  status?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const verdict = getUnifiedVerdict(status);
  const label = VERDICT_DISPLAY_NAMES[verdict] ?? verdict;
  return (
    <span
      className={`v-verdict-badge v-verdict-badge-${size} v-verdict-badge-${verdict.toLowerCase()} ${className}`.trim()}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}

export type InspectorRiskLevel = 'LOW RISK' | 'MODERATE RISK' | 'HIGH RISK' | 'UNAUDITED';

export function getInspectorRisk(
  status?: string | null,
  score?: number | null,
): {
  level: InspectorRiskLevel;
  className: string;
} {
  const norm = (status || '').toUpperCase().trim();
  if (typeof score === 'number') {
    if (score >= 75 || norm === 'PASS' || norm === 'VERIFIED') {
      return { level: 'LOW RISK', className: 'v-verdict-badge-verified' };
    }
    if (score >= 50 || norm === 'WARN' || norm === 'REVIEW') {
      return { level: 'MODERATE RISK', className: 'v-verdict-badge-review' };
    }
    return { level: 'HIGH RISK', className: 'v-verdict-badge-blocked' };
  }

  if (norm === 'PASS' || norm === 'POLICY_PASS' || norm === 'VERIFIED' || norm === 'ACTIVE') {
    return { level: 'LOW RISK', className: 'v-verdict-badge-verified' };
  }
  if (norm === 'WARN' || norm === 'REVIEW') {
    return { level: 'MODERATE RISK', className: 'v-verdict-badge-review' };
  }
  if (norm === 'FAIL' || norm === 'BLOCKED' || norm === 'REVOKED' || norm === 'CRITICAL') {
    return { level: 'HIGH RISK', className: 'v-verdict-badge-blocked' };
  }
  return { level: 'UNAUDITED', className: 'v-verdict-badge-unaudited' };
}

export function getScoreColorClass(
  score?: number | null,
  fallbackStatus?: string | null,
): string {
  if (typeof score === 'number' && Number.isFinite(score)) {
    if (score >= 75) return 'v-score-green';
    if (score >= 50) return 'v-score-yellow';
    return 'v-score-red';
  }
  const norm = (fallbackStatus || '').toUpperCase().trim();
  if (
    norm === 'PASS' ||
    norm === 'POLICY_PASS' ||
    norm === 'VERIFIED' ||
    norm === 'ACTIVE'
  ) {
    return 'v-score-green';
  }
  if (norm === 'WARN' || norm === 'REVIEW') {
    return 'v-score-yellow';
  }
  if (
    norm === 'FAIL' ||
    norm === 'BLOCKED' ||
    norm === 'REVOKED' ||
    norm === 'CRITICAL'
  ) {
    return 'v-score-red';
  }
  return 'v-score-gray';
}

export function ColoredScore({
  score,
  max = 100,
  fallbackStatus,
  className = '',
  style,
}: {
  score?: number | null;
  max?: number | null;
  fallbackStatus?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const colorClass = getScoreColorClass(score, fallbackStatus);
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return (
      <span className={`v-trust-score-num v-score-gray ${className}`.trim()} style={style}>
        —
      </span>
    );
  }
  return (
    <span className={`v-trust-score-num ${colorClass} ${className}`.trim()} style={style}>
      {score}
      {max ? <span className="v-trust-score-max">/{max}</span> : null}
    </span>
  );
}

export function InspectorRiskBadge({
  status,
  score,
  size = 'sm',
  className = '',
}: {
  status?: string | null;
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { level, className: toneClass } = getInspectorRisk(status, score);
  return (
    <span
      className={`v-verdict-badge v-verdict-badge-${size} ${toneClass} ${className}`.trim()}
      aria-label={`Risk assessment: ${level}`}
    >
      {level}
    </span>
  );
}

export default StatusBadge;
