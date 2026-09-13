import assert from 'node:assert/strict';
import test from 'node:test';
import { Wallet, getBytes, verifyMessage } from 'ethers';
import { signAgentDeployment } from './agent-wallet-signing.ts';

test('a Privy-style Ethereum provider signs without wallet.signMessage', async () => {
  const wallet = Wallet.createRandom();
  const methods: string[] = [];
  const ethereumProvider = {
    async request({ method, params }: { method: string; params?: readonly unknown[] | object }) {
      methods.push(method);
      if (method === 'eth_chainId') return '0xaa36a7';
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [wallet.address];
      if (method === 'personal_sign' && Array.isArray(params)) return wallet.signMessage(getBytes(params[0] as string));
      throw new Error(`Unexpected request: ${method}`);
    },
  };
  const result = await signAgentDeployment(ethereumProvider, wallet.address, 'auditor', 'Reject unverified custody evidence.');
  assert.equal(result.owner, wallet.address);
  assert.equal(verifyMessage(result.message, result.signature), wallet.address);
  assert.ok(methods.includes('personal_sign'));
});
