'use client';

import { useEffect, useState } from 'react';
import { findDeployment } from '@/lib/custom-agent-store';
import { AgentIdentityProof } from '@/components/app/agent-identity-proof';

export type VerifiedCustomAgent = { name: string; owner: string; policy: string; context: string; sourceBlock: number };

/**
 * Showcase lens deployed onchain. Shown to every visitor (fresh browsers,
 * judges) after live verification — selecting one runs the same colab flow
 * as a self-deployed agent. Kept to names confirmed live with owner+policy.
 */
const FEATURED_CUSTOM_AGENTS = ['kahfajask.verdict.eth'];

export function CustomAgentPicker({ names, selected, running, onSelect, onVerified }: {
  names: string[]; selected: string; running: boolean;
  onSelect: (name: string) => void; onVerified: (agent: VerifiedCustomAgent | null) => void;
}) {
  const [agent, setAgent] = useState<VerifiedCustomAgent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [featured, setFeatured] = useState<VerifiedCustomAgent[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const out: VerifiedCustomAgent[] = [];
      for (const name of FEATURED_CUSTOM_AGENTS) {
        try {
          const response = await fetch(`/api/agents/custom?name=${encodeURIComponent(name)}`, { cache: 'no-store', signal: controller.signal });
          const result = await response.json();
          if (response.ok && result.ok && result.agent?.name === name && result.agent.policy) out.push(result.agent);
        } catch {
          // Unverifiable featured names stay hidden — never offer a dead lens.
        }
      }
      if (!controller.signal.aborted) setFeatured(out);
    })();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setAgent(null); setError(''); onVerified(null);
    if (!selected) { setLoading(false); return () => controller.abort(); }
    setLoading(true);
    async function verify() {
      try {
        const response = await fetch(`/api/agents/custom?name=${encodeURIComponent(selected)}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok || result.agent?.name !== selected) throw new Error(result.error || 'Agent verification unavailable.');
        if (!controller.signal.aborted) { setAgent(result.agent); onVerified(result.agent); }
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Agent verification unavailable.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void verify();
    return () => controller.abort();
  }, [selected, retry, onVerified]);
  return <div>
    {featured.filter((f) => f.name !== selected).length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <label>Demo lens · verified live on ENS</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {featured.filter((f) => f.name !== selected).map((f) => (
            <div key={f.name}>
              <AgentIdentityProof subname={f.name} owner={f.owner} compact />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, opacity: 0.75 }}>Public demo policy · ENS block {f.sourceBlock}</span>
                <button
                  type="button"
                  className="v-btn v-btn-secondary"
                  style={{ padding: '4px 12px', fontSize: 12, height: 'auto' }}
                  onClick={() => onSelect(f.name)}
                  disabled={running}
                >
                  Use this lens
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    <label htmlFor="custom-agent-picker">Deployed custom agent</label>
    <select id="custom-agent-picker" value={selected} onChange={(event) => onSelect(event.target.value)} disabled={running || !names.length}>
      {!names.length && <option value="">No saved agents — deploy one above</option>}
      {names.map((name) => <option key={name} value={name}>{name}</option>)}
    </select>
    <p role="status" style={{ fontSize: 12, marginTop: 8 }}>
      {loading ? 'Reading owner and policy live from ENS…' : error || (!selected ? 'Agents deployed in this browser appear here automatically.' : agent ? `Active lens: ${agent.name} · ENS block ${agent.sourceBlock}` : '')}
    </p>
    {error && <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={running || loading}>Retry ENS verification</button>}
    {agent && <div style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
      <AgentIdentityProof
        subname={agent.name}
        owner={agent.owner}
        registerTx={findDeployment(agent.name)?.register ?? null}
        recordsTx={findDeployment(agent.name)?.records ?? null}
        compact
      />
      <p style={{ marginTop: 8 }}>Policy: {agent.policy}</p>
      <p>This lens applies to Consensus after the three inspectors report. Owner and policy are re-read before every run.</p>
    </div>}
    <p style={{ fontSize: 11, opacity: 0.7 }}>Saved names are browser- and domain-local, not chain verification. A different browser/domain won’t share this list. Policies are public ENS records.</p>
  </div>;
}
