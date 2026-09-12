import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_ASSETS } from '../components/app/demo-data.ts';
import { ENS_EXPLORER_NAME_URL } from './ensv2-config.ts';

test('all 20 RWA assets have dedicated hackathon ENS Explorer URLs', () => {
  const rwaAssets = DEMO_ASSETS.filter((asset) => asset.name.endsWith('.rwa.verdict.eth'));
  assert.equal(rwaAssets.length, 20);

  for (const asset of rwaAssets) {
    assert.equal(
      ENS_EXPLORER_NAME_URL(asset.name),
      `https://hackathon-deployment-portal-app.ens-cf.workers.dev/${asset.name}`,
    );
  }
});
