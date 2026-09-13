'use client';

import { useEffect, useState } from 'react';
import { findDeployment } from '@/lib/custom-agent-store';
import { AgentIdentityProof } from '@/components/app/agent-identity-proof';

export type VerifiedCustomAgent = { name: string; owner: string; policy: string; context: string; sourceBlock: number };

export function CustomAgentPicker({ names, selected, running, onSelect, onVerified }: {
  names: string[]; selected: string; running: boolean;
  onSelect: (name: string) => void; onVerified: (agent: VerifiedCustomAgent | null) => void;
}) {
  const [agent, setAgent] = useState<VerifiedCustomAgent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
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
    </div>}
  </div>;
}
