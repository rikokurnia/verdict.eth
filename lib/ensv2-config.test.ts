import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENS_ADDRESS_HISTORY_URL,
  ENS_EXPLORER_NAME_URL,
  ENS_NAME_HISTORY_URL,
  ENS_NAME_RECORDS_URL,
  ENS_NAME_REGISTRY_URL,
  ENS_NAME_RESOLVER_URL,
  ENS_NAME_ROLES_URL,
  ENS_REGISTRY_URL,
  ENS_RESOLVER_ROLES_URL,
  ENS_RESOLVER_URL,
} from './ensv2-config.ts';

const portal = 'https://hackathon-deployment-portal-app.ens-cf.workers.dev';
const name = 'usd-yield-001.acme.verdict.eth';
const address = '0xB18cCDb9fFE2A3CB50Dd00c3Ece15e55c98410cE';

test('hackathon ENS Explorer helpers use its actual route structure', () => {
  assert.equal(ENS_EXPLORER_NAME_URL(name), `${portal}/${name}`);
  assert.equal(ENS_NAME_RECORDS_URL(name), `${portal}/${name}/records`);
  assert.equal(ENS_NAME_ROLES_URL(name), `${portal}/${name}/roles`);
  assert.equal(ENS_NAME_REGISTRY_URL(name), `${portal}/${name}/registry`);
  assert.equal(ENS_NAME_RESOLVER_URL(name), `${portal}/${name}/resolver`);
  assert.equal(ENS_NAME_HISTORY_URL(name), `${portal}/${name}/history`);
  assert.equal(ENS_RESOLVER_URL(address), `${portal}/resolver/${address}`);
  assert.equal(ENS_RESOLVER_ROLES_URL(address), `${portal}/resolver/${address}/roles`);
  assert.equal(ENS_REGISTRY_URL(address), `${portal}/registry/${address}`);
  assert.equal(ENS_ADDRESS_HISTORY_URL(address), `${portal}/addr/${address}/history`);
});
