import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JsonRpcProvider, makeError } from 'ethers';
import { callBlocked } from './ens-permissions.ts';
import { assertSigningOptIn } from './ens-permission-policy.ts';

const actor = '0x0000000000000000000000000000000000000001';
const resolver = '0x0000000000000000000000000000000000000002';
test('only an actual EVM revert establishes a denied permission', async () => {
  const reverted = { call: async () => { throw makeError('reverted', 'CALL_EXCEPTION', { action: 'call', data: '0x', reason: null, transaction: { to: resolver, data: '0x' }, invocation: null, revert: null }); } } as unknown as JsonRpcProvider;
  assert.equal(await callBlocked(reverted, actor, resolver, '0x', 123), true);
  const success = { call: async () => '0x' } as unknown as JsonRpcProvider;
  assert.equal(await callBlocked(success, actor, resolver, '0x', 123), false);
  const unavailable = { call: async () => { throw new Error('RPC timed out'); } } as unknown as JsonRpcProvider;
  await assert.rejects(callBlocked(unavailable, actor, resolver, '0x', 123), /RPC timed out/);
});

test('permission probes carry the requested public actor and pinned block', async () => {
  const p = { call: async (request: unknown) => { assert.deepEqual(request, { from: actor, to: resolver, data: '0x1234', blockTag: 123 }); return '0x'; } } as unknown as JsonRpcProvider;
  await callBlocked(p, actor, resolver, '0x1234', 123);
});

test('role-changing setup refuses to load keystores without explicit signing opt-in', () => {
  for (const [apply, allow] of [[false, false], [false, true], [true, false]]) {
    assert.throws(() => assertSigningOptIn(apply, allow), /Apply requires/);
  }
  assert.doesNotThrow(() => assertSigningOptIn(true, true));
  const source = readFileSync('scripts/setup-rwa-evidence.mjs', 'utf8');
  assert.match(source, /async function signer[\s\S]*?assertSigningOptIn[\s\S]*?Wallet.fromEncryptedJson/);
});

test('legacy permission command is non-mutating without --apply', () => {
  const source = readFileSync('scripts/configure-ensv2-permissions.mjs', 'utf8');
  assert.match(source, /async function main\(\) \{\s*if \(!process.argv.includes\('--apply'\)\) \{[\s\S]*?return;\s*\}\s*const env = loadEnv/);
});
