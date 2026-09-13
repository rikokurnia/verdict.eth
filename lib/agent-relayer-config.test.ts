import assert from 'node:assert/strict';
import test from 'node:test';
import { sponsoredMintEnabled } from './agent-relayer-config.ts';

test('Vercel sponsored mint requires explicit enablement and both server secrets', () => {
  assert.equal(sponsoredMintEnabled({ VERCEL: '1' }), false);
  const enabled = { VERCEL: '1', VERDICT_SPONSORED_MINT_ENABLED: 'true' };
  assert.equal(sponsoredMintEnabled(enabled), false);
  assert.equal(sponsoredMintEnabled({ ...enabled, VERDICT_RELAYER_KEYSTORE_JSON: '{}' }), false);
  assert.equal(sponsoredMintEnabled({ ...enabled, VERDICT_RELAYER_KEYSTORE_PASSWORD: 'fixture' }), false);
  const configured = { ...enabled, VERDICT_RELAYER_KEYSTORE_JSON: '{}', VERDICT_RELAYER_KEYSTORE_PASSWORD: 'fixture' };
  assert.equal(sponsoredMintEnabled(configured), true);
  assert.equal(sponsoredMintEnabled({ ...configured, VERDICT_SPONSORED_MINT_ENABLED: 'false' }), false);
  assert.equal(sponsoredMintEnabled({}), true);
  assert.equal(sponsoredMintEnabled({ VERDICT_SPONSORED_MINT_ENABLED: 'false' }), false);
});
