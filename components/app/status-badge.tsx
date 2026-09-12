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
  return (
    <span
      className={`v-verdict-badge v-verdict-badge-${size} v-verdict-badge-${verdict.toLowerCase()} ${className}`.trim()}
      aria-label={`Status: ${verdict}`}
    >
      {verdict}
    </span>
  );
}

export default StatusBadge;
