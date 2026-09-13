import assert from 'node:assert/strict';
import test from 'node:test';
import { QUARTET_ASSET_LABELS, QUARTET_REPORT_KEYS, quartetReportKey } from './quartet-authority-policy.ts';

test('all twenty canonical assets have unique report keys, plus the demo', () => {
  assert.equal(QUARTET_ASSET_LABELS.length, 20);
  assert.equal(new Set(QUARTET_REPORT_KEYS).size, 21);
  for (const label of QUARTET_ASSET_LABELS) {
    assert.ok(QUARTET_REPORT_KEYS.includes(quartetReportKey(`${label}.rwa.verdict.eth`)));
  }
  assert.equal(quartetReportKey('usd-yield-001.acme.verdict.eth'), 'verdict.agent.report.demo');
});

test('rejects arbitrary subjects and namespace lookalikes', () => {
  for (const name of ['buidl', 'buidl.verdict.eth', 'fake.rwa.verdict.eth', 'buidl.rwa.verdict.eth.evil.eth']) {
    assert.throws(() => quartetReportKey(name));
  }
});
