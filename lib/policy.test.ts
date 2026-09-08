import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, type Evidence } from './policy.ts';
const valid: Evidence = { daysRemaining: 30, fresh: true, revoked: false, available: true, riskConflict: false };
test('expiry boundary and review window', () => {
  assert.equal(evaluate(valid).state, 'POLICY_PASS');
  assert.equal(evaluate({...valid, daysRemaining: 14}).state, 'POLICY_PASS');
  assert.equal(evaluate({...valid, daysRemaining: 13}).state, 'REVIEW');
  assert.equal(evaluate({...valid, daysRemaining: 0}).state, 'BLOCKED');
});
test('missing evidence is never treated as a pass', () => {
  assert.equal(evaluate({...valid, available:false}).state, 'UNAVAILABLE');
  for (const change of [{fresh:false},{revoked:true},{riskConflict:true}]) assert.equal(evaluate({...valid,...change}).state, 'BLOCKED');
});
