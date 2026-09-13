export const CUSTOM_AGENTS_KEY = 'verdict:custom-agents:v1';
export const LEGACY_CUSTOM_AGENT_KEY = 'verdict-custom-agent';
export const CUSTOM_AGENT_EVENT = 'verdict:auditor-minted';
let memory: string[] = [];

export function validCustomAgentName(name: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?\.verdict\.eth$/.test(name);
}

export function normalizeSavedAgents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((name): name is string => typeof name === 'string')
    .map((name) => name.trim().toLowerCase()).filter(validCustomAgentName))].slice(0, 40);
}

export function loadCustomAgents(): string[] {
  if (typeof window === 'undefined') return [];
  let saved: unknown = [];
  let legacy = '';
  try { legacy = window.localStorage.getItem(LEGACY_CUSTOM_AGENT_KEY) || ''; } catch {}
  try { saved = JSON.parse(window.localStorage.getItem(CUSTOM_AGENTS_KEY) || '[]'); } catch {}
  return normalizeSavedAgents([legacy, ...normalizeSavedAgents(saved), ...memory]);
}

/** Discovery hints only. Never persist owner, policy, or a verification claim. */
export function rememberCustomAgent(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!validCustomAgentName(normalized)) return;
  memory = normalizeSavedAgents([normalized, ...loadCustomAgents()]);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_AGENTS_KEY, JSON.stringify(memory));
    window.localStorage.setItem(LEGACY_CUSTOM_AGENT_KEY, normalized);
  } catch { /* Keep same-page discovery usable in privacy/quota mode. */ }
  window.dispatchEvent(new CustomEvent(CUSTOM_AGENT_EVENT, { detail: normalized }));
}
