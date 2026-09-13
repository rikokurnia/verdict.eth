import assert from 'node:assert/strict';
import test from 'node:test';
import { CUSTOM_AGENTS_KEY, CUSTOM_AGENT_EVENT, LEGACY_CUSTOM_AGENT_KEY, loadCustomAgents, normalizeSavedAgents, rememberCustomAgent, validCustomAgentName } from './custom-agent-store.ts';

test('only canonical factory names are accepted', () => {
  for (const name of ['a.verdict.eth', 'zero-risk.verdict.eth', `${'a'.repeat(32)}.verdict.eth`]) assert.equal(validCustomAgentName(name), true);
  for (const name of ['legal.agent.verdict.eth', '-a.verdict.eth', 'a-.verdict.eth', 'foo.eth', `${'a'.repeat(33)}.verdict.eth`, '../a.verdict.eth']) assert.equal(validCustomAgentName(name), false);
});

test('saved names are normalized, deduplicated and bounded; policies are not accepted', () => {
  assert.deepEqual(normalizeSavedAgents([' ZERO-RISK.VERDICT.ETH ', 'zero-risk.verdict.eth', { policy: 'fake' }, 'foo.eth']), ['zero-risk.verdict.eth']);
  assert.deepEqual(normalizeSavedAgents({ name: 'foo.verdict.eth' }), []);
  assert.equal(normalizeSavedAgents(Array.from({ length: 100 }, (_, i) => `agent-${i}.verdict.eth`)).length, 40);
});

test('SSR reads require neither window nor local files', () => {
  assert.deepEqual(loadCustomAgents(), []);
});

test('legacy agent is migrated and multiple new deployments survive reload-like reads', () => {
  const map = new Map<string, string>([[LEGACY_CUSTOM_AGENT_KEY, 'old.verdict.eth']]);
  const events: Event[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => map.get(key) || null, setItem: (key: string, value: string) => map.set(key, value) },
    dispatchEvent: (event: Event) => events.push(event),
  } });
  try {
    assert.deepEqual(loadCustomAgents(), ['old.verdict.eth']);
    rememberCustomAgent('first.verdict.eth'); rememberCustomAgent('second.verdict.eth');
    assert.deepEqual(loadCustomAgents(), ['second.verdict.eth', 'first.verdict.eth', 'old.verdict.eth']);
    assert.equal(map.get(LEGACY_CUSTOM_AGENT_KEY), 'second.verdict.eth');
    assert.equal(events.at(-1)?.type, CUSTOM_AGENT_EVENT);
    assert.deepEqual(JSON.parse(map.get(CUSTOM_AGENTS_KEY)!), ['second.verdict.eth', 'first.verdict.eth', 'old.verdict.eth']);
    map.set(CUSTOM_AGENTS_KEY, '{broken');
    assert.doesNotThrow(loadCustomAgents);
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});

test('storage-disabled browsers still discover a freshly deployed agent on the same page', () => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } }, dispatchEvent: () => true,
  } });
  try { rememberCustomAgent('privacy.verdict.eth'); assert.ok(loadCustomAgents().includes('privacy.verdict.eth')); }
  finally { Reflect.deleteProperty(globalThis, 'window'); }
});
