/**
 * Client-safe auditor-branch deployment policy. No node:fs, no keystores —
 * safe to import from browser components for self-pay (user-wallet) mints.
 * Server code in lib/agents/factory.ts re-exports the bitmap/roles so both
 * paths can never drift apart.
 */

export const AUDITOR_BRANCH_BITMAP =
  (BigInt(1) << BigInt(4)) | ((BigInt(1) << BigInt(4)) << BigInt(128));

export const AUDITOR_BRANCH_ROLES =
  'ROLE_SET_TEXT (bit 4) + ROLE_SET_TEXT_ADMIN (bit 132), name-scoped';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Branch registration lifetime: 180 days, matching the sponsored path. */
export const SUBNAME_LIFETIME_SECONDS = BigInt(180 * 86_400);

export const MAX_POLICY_CHARS = 2000;

export const AGENT_REGISTRY_ABI = [
  'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
  'function getStatus(uint256 anyId) view returns (uint8)',
] as const;

export const AGENT_RESOLVER_ABI = [
  'function setText(bytes name,string key,string value)',
  'function multicall(bytes[] calls) returns (bytes[] results)',
] as const;

export function branchContext(subname: string, owner: string) {
  return `Custom auditor ${subname} operated by ${owner}. Inspection policy published in agent.policy.`;
}
