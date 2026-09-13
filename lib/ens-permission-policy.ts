import { ENSV2_SEPOLIA } from './ensv2-config.ts';

export const SET_TEXT = BigInt(1) << BigInt(4);
export const SET_TEXT_ADMIN = SET_TEXT << BigInt(128);
export const UPGRADE = BigInt(1) << BigInt(124);

export const AUDITOR_KEYS = [
  'verdict.attestation.documentHash', 'verdict.attestation.issuedAt',
  'verdict.attestation.expiresAt', 'verdict.attestation.status',
  'verdict.attestation.ai.model', 'verdict.attestation.ai.confidence',
  'verdict.attestation.ai.rationale', 'verdict.attestation.ai.sourceHash',
] as const;
export const MONITOR_KEYS = [
  'verdict.observation.observedAt', 'verdict.observation.severity',
  'verdict.observation.reasonCode', 'verdict.observation.status',
  'verdict.observation.ai.model', 'verdict.observation.ai.confidence',
  'verdict.observation.ai.rationale', 'verdict.observation.ai.sourceHash',
] as const;

export function evidenceAuthorities(assetName: string) {
  const isDemo = assetName === ENSV2_SEPOLIA.names.asset;
  const label = assetName.replace(/\.rwa\.verdict\.eth$/, '');
  if (!isDemo && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) || label === assetName)) {
    throw new Error('Expected a canonical Verdict RWA asset name.');
  }
  return {
    auditor: { name: isDemo ? ENSV2_SEPOLIA.names.audit : `${label}.verdict-auditor.eth`, resolver: ENSV2_SEPOLIA.proxies.auditorResolver,
      registry: ENSV2_SEPOLIA.proxies.auditorRegistry, worker: ENSV2_SEPOLIA.actors.auditorWorker,
      admin: ENSV2_SEPOLIA.actors.auditorAdmin, keys: AUDITOR_KEYS },
    monitor: { name: isDemo ? ENSV2_SEPOLIA.names.observation : `${label}.verdict-monitor.eth`, resolver: ENSV2_SEPOLIA.proxies.monitorResolver,
      registry: ENSV2_SEPOLIA.proxies.monitorRegistry, worker: ENSV2_SEPOLIA.actors.monitorWorker,
      admin: ENSV2_SEPOLIA.actors.monitorAdmin, keys: MONITOR_KEYS },
  };
}

export function assertAllowedRecords(keys: readonly string[], records: Record<string, string>) {
  if (!Object.keys(records).length || Object.keys(records).some((key) => !keys.includes(key))) {
    throw new Error('Evidence write contains a key outside the worker permission policy.');
  }
}

export type PermissionChecks = {
  nameActive: boolean; ownerMatches: boolean; resolverMatches: boolean; subjectMatches: boolean; allKeysAllowed: boolean;
  noRootText: boolean; noRootTextAdmin: boolean; noUpgrade: boolean; noUpgradeAdmin: boolean; allowedWriteVerified: boolean;
  unrelatedWriteBlocked: boolean; issuerWriteBlocked: boolean; crossWorkerWriteBlocked: boolean;
  workerGrantBlocked: boolean; recoveryAdminVerified: boolean;
};

export function permissionsVerified(checks: PermissionChecks) {
  return Object.values(checks).every((check) => check === true);
}

export function assertSigningOptIn(apply: boolean, allowKeystoreSigning: boolean) {
  if (!apply || !allowKeystoreSigning) throw new Error('Apply requires --apply --allow-keystore-signing.');
}
