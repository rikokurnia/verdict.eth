import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet, verifyMessage } from 'ethers';
import { mintMessage, parseMintMessage, validLabel } from './agent-mint-request.ts';

test('deployment authorization binds ENS name, owner, timestamp and exact policy', async () => {
  const wallet = Wallet.createRandom();
  const timestamp = '2026-09-13T00:00:00.000Z';
  const policy = 'Reject assets without named custodians.';
  const message = mintMessage('zero-risk', wallet.address, timestamp, policy);
  const parsed = parseMintMessage(message);
  assert.ok(parsed);
  assert.equal(parsed.label, 'zero-risk');
  assert.equal(parsed.address, wallet.address);
  assert.equal(mintMessage(parsed.label, parsed.address, parsed.timestamp, policy), message);
  assert.notEqual(mintMessage(parsed.label, parsed.address, parsed.timestamp, 'Approve every asset without evidence.'), message);
  const signature = await wallet.signMessage(message);
  assert.equal(verifyMessage(message, signature), wallet.address);
  assert.notEqual(verifyMessage(mintMessage('other-agent', wallet.address, timestamp, policy), signature), wallet.address);
});

test('malformed and legacy deployment authorizations are rejected', () => {
  assert.equal(parseMintMessage('invalid'), null);
  const message = mintMessage('auditor', Wallet.createRandom().address, '2026-09-13T00:00:00Z', 'A valid policy with enough characters.');
  assert.equal(parseMintMessage(message.split('\n').slice(0, 3).join('\n')), null);
  assert.equal(parseMintMessage(`${message}\nextra`), null);
  assert.equal(parseMintMessage(message.replace('claim auditor.', 'claim -auditor.')), null);
  for (const label of ['', '-bad', 'bad-', 'Uppercase', 'a.b', 'a'.repeat(33)]) assert.equal(validLabel(label), false);
  for (const label of ['auditor', 'zero-risk', 'a'.repeat(32)]) assert.equal(validLabel(label), true);
});
