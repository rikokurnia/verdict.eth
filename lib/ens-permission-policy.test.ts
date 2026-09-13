import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_ASSETS } from '../components/app/demo-data.ts';
import { ENSV2_SEPOLIA } from './ensv2-config.ts';
import { AUDITOR_KEYS, MONITOR_KEYS, assertAllowedRecords, evidenceAuthorities, permissionsVerified, type PermissionChecks } from './ens-permission-policy.ts';

test('all 20 RWA assets have distinct evidence names on separate authority resolvers', () => {
  const assets = DEMO_ASSETS.filter((asset) => asset.name.endsWith('.rwa.verdict.eth'));
  assert.equal(assets.length, 20);
  const names = new Set<string>();
  for (const asset of assets) {
    const { auditor, monitor } = evidenceAuthorities(asset.name);
    assert.notEqual(auditor.resolver, ENSV2_SEPOLIA.proxies.namespaceResolver);
    assert.notEqual(auditor.resolver, monitor.resolver);
    assert.notEqual(auditor.worker, monitor.worker);
    names.add(auditor.name); names.add(monitor.name);
  }
  assert.equal(names.size, 40);
});

test('demo evidence names remain distinct from quartet discovery names', () => {
  assert.equal(ENSV2_SEPOLIA.names.audit, 'audit-001.verdict-auditor.eth');
  assert.equal(ENSV2_SEPOLIA.names.observation, 'risk-001.verdict-monitor.eth');
  assert.notEqual(ENSV2_SEPOLIA.names.audit, ENSV2_SEPOLIA.names.agents.legal);
});

test('worker write policy rejects cross-role, identity and arbitrary keys', () => {
  assertAllowedRecords(AUDITOR_KEYS, { 'verdict.attestation.status': 'active' });
  assertAllowedRecords(MONITOR_KEYS, { 'verdict.observation.severity': 'info' });
  for (const key of ['verdict.subject', 'verdict.schema', 'verdict.observation.status', 'agent.policy', 'verdict.quartet.score']) {
    assert.throws(() => assertAllowedRecords(AUDITOR_KEYS, { [key]: 'probe' }));
  }
  assert.throws(() => assertAllowedRecords(MONITOR_KEYS, { 'verdict.attestation.status': 'revoked' }));
  assert.throws(() => assertAllowedRecords(AUDITOR_KEYS, {}));
});

test('any failed live check prevents a verified permission claim', () => {
  const checks: PermissionChecks = { nameActive: true, ownerMatches: true, resolverMatches: true, subjectMatches: true, allKeysAllowed: true,
    noRootText: true, noRootTextAdmin: true, noUpgrade: true, noUpgradeAdmin: true, allowedWriteVerified: true, unrelatedWriteBlocked: true,
    issuerWriteBlocked: true, crossWorkerWriteBlocked: true, workerGrantBlocked: true, recoveryAdminVerified: true };
  assert.equal(permissionsVerified(checks), true);
  for (const key of Object.keys(checks) as (keyof PermissionChecks)[]) assert.equal(permissionsVerified({ ...checks, [key]: false }), false);
});

test('untrusted/noncanonical asset names cannot select authority write targets', () => {
  for (const name of ['legal.agent.verdict.eth', 'buidl.eth', 'foo.bar.rwa.verdict.eth', '../buidl.rwa.verdict.eth']) assert.throws(() => evidenceAuthorities(name));
});
