import type { VerdictState } from '@/lib/policy';

export type DemoAsset = {
  title: string;
  name: string;
  ticker: string;
  assetClass: string;
  issuer: string;
  state: VerdictState;
  auditNote: string;
  riskNote: string;
  heartbeat: string;
  network: string;
};

export const DEMO_ASSETS: DemoAsset[] = [
  {
    title: 'USD Yield 001', name: 'usd-yield-001.acme.verdict.eth', ticker: 'USDY-001',
    assetClass: 'Yield', issuer: 'ACME', state: 'POLICY_PASS',
    auditNote: 'Valid · 27d', riskNote: 'Low', heartbeat: '12s ago', network: 'Sepolia',
  },
  {
    title: 'USD Yield 002', name: 'usd-yield-002.acme.verdict.eth', ticker: 'USDY-002',
    assetClass: 'Yield', issuer: 'ACME', state: 'REVIEW',
    auditNote: 'Expiring · 7d', riskNote: 'Low', heartbeat: '40s ago', network: 'Sepolia',
  },
  {
    title: 'EUR Bond 003', name: 'eur-bond-003.acme.verdict.eth', ticker: 'EURB-003',
    assetClass: 'Bond', issuer: 'ACME', state: 'BLOCKED',
    auditNote: 'Expired 14m ago', riskNote: 'Stale', heartbeat: '2h ago', network: 'Sepolia',
  },
  {
    title: 'US T-Bill 004', name: 'us-tbill-004.acme.verdict.eth', ticker: 'USTB-004',
    assetClass: 'Treasury', issuer: 'ACME', state: 'BLOCKED',
    auditNote: 'Revoked', riskNote: 'Conflict', heartbeat: '5m ago', network: 'Sepolia',
  },
];

export const DEMO_ACTIVITY = [
  { label: 'AUDIT UPDATED', text: 'Audit hash and expiry changed by audit-001.auditor.eth', time: '12 sec ago', tx: '0x78f…a12' },
  { label: 'VERDICT CHANGED', text: 'eur-bond-003.acme.verdict.eth flipped to BLOCKED', time: '14 min ago', tx: '0x3bc…77e' },
  { label: 'WRITE BLOCKED', text: 'Issuer attempted SET_TEXT:audit-hash — reverted', time: '32 min ago', tx: '0x91d…04b' },
];
