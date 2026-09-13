import { keccak256, toUtf8Bytes } from 'ethers';

export function validLabel(label: string): boolean {
  return /^[a-z0-9-]{1,32}$/.test(label) && !label.startsWith('-') && !label.endsWith('-');
}

export function mintMessage(label: string, address: string, timestamp: string, policy: string) {
  return [
    `Verdict Auditor Factory — claim ${label}.verdict.eth`,
    `Owner: ${address}`,
    `Timestamp: ${timestamp}`,
    `Policy hash: ${keccak256(toUtf8Bytes(policy))}`,
  ].join('\n');
}

export function parseMintMessage(message: string) {
  const lines = message.trim().split('\n');
  if (lines.length !== 4) return null;
  const label = /^Verdict Auditor Factory — claim ([a-z0-9-]{1,32})\.verdict\.eth$/.exec(lines[0])?.[1];
  const address = /^Owner: (0x[0-9a-fA-F]{40})$/.exec(lines[1])?.[1];
  const timestamp = /^Timestamp: (\S+)$/.exec(lines[2])?.[1];
  const policyHash = /^Policy hash: (0x[0-9a-f]{64})$/.exec(lines[3])?.[1];
  return label && validLabel(label) && address && timestamp && policyHash
    ? { label, address, timestamp, policyHash }
    : null;
}
