export const CUSTOM_AGENTS_KEY = 'verdict:custom-agents:v1';
export const LEGACY_CUSTOM_AGENT_KEY = 'verdict-custom-agent';
export const CUSTOM_AGENT_EVENT = 'verdict:auditor-minted';
const DEPLOYMENTS_KEY = 'verdict:custom-deployments:v1';
let memory: string[] = [];

export type DeploymentRecord = {
  subname: string;
  owner: string;
  register: { hash: string; blockNumber: number };
  records: { hash: string; blockNumber: number };
  mode: 'sponsored' | 'self-pay';
  deployedAt: string;
};

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

function normalizeDeployments(value: unknown): DeploymentRecord[] {
  if (!Array.isArray(value)) return [];
  const out: DeploymentRecord[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Partial<DeploymentRecord>;
    if (typeof record.subname !== 'string' || !validCustomAgentName(record.subname.trim().toLowerCase())) continue;
    if (typeof record.owner !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(record.owner)) continue;
    const tx = (t: unknown) => (t && typeof t === 'object'
      && typeof (t as { hash?: unknown }).hash === 'string'
      && Number.isFinite(Number((t as { blockNumber?: unknown }).blockNumber))
      ? { hash: (t as { hash: string }).hash, blockNumber: Number((t as { blockNumber: number }).blockNumber) }
      : null);
    const register = tx(record.register);
    const records = tx(record.records);
    if (!register || !records) continue;
    out.push({
      subname: record.subname.trim().toLowerCase(),
      owner: record.owner,
      register,
      records,
      mode: record.mode === 'self-pay' ? 'self-pay' : 'sponsored',
      deployedAt: typeof record.deployedAt === 'string' ? record.deployedAt : new Date().toISOString(),
    });
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.subname) ? false : (seen.add(r.subname), true))).slice(0, 20);
}

/**
 * This browser's own successful deployments (subname + tx hashes + owner).
 * Everything stored here is already public onchain; it only saves the user
 * from refilling the form and powers the proof rows. Other browsers never
 * see it.
 */
export function loadDeployments(): DeploymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return normalizeDeployments(JSON.parse(window.localStorage.getItem(DEPLOYMENTS_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function findDeployment(subname: string): DeploymentRecord | null {
  const normalized = subname.trim().toLowerCase();
  return loadDeployments().find((d) => d.subname === normalized) ?? null;
}

export function rememberDeployment(record: Omit<DeploymentRecord, 'deployedAt'> & { deployedAt?: string }): DeploymentRecord[] {
  const list = normalizeDeployments([
    { ...record, subname: record.subname.trim().toLowerCase(), deployedAt: record.deployedAt ?? new Date().toISOString() },
    ...loadDeployments(),
  ]);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DEPLOYMENTS_KEY, JSON.stringify(list));
    } catch { /* Private mode: in-memory list for this page still works. */ }
  }
  rememberCustomAgent(record.subname);
  return list;
}
