'use client';

import { useState } from 'react';
import { ENS_EXPLORER_NAME_URL, ENS_RESOLVER_ROLES_URL } from '@/lib/ensv2-config';
import { evidenceAuthorities } from '@/lib/ens-permission-policy';
import type { verifyAssetPermissions } from '@/lib/ens-permissions';

type Proof = Awaited<ReturnType<typeof verifyAssetPermissions>>;

export function EvidencePermissions({ name }: { name: string }) {
  const authorities = evidenceAuthorities(name);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [proof, setProof] = useState<Proof | null>(null);
  async function verify() {
    setState('loading');
    setProof(null);
    try {
      const response = await fetch(`/api/ens/permissions?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.ok || result.proof?.assetName !== name) throw new Error('Unavailable');
      setProof(result.proof);
      setState('ready');
    } catch { setState('error'); }
  }
  return <div style={{ marginTop: 10 }}>
    {Object.entries(authorities).map(([role, authority]) => <div key={role} style={{ marginBottom: 8 }}>
      <span>{role === 'auditor' ? 'Auditor' : 'Risk sentinel'}: </span>
      <a className="v-ens-explorer-proof" href={ENS_EXPLORER_NAME_URL(authority.name)} target="_blank" rel="noreferrer">Evidence name ↗</a>
      {' · '}<a className="v-ens-explorer-proof" href={ENS_RESOLVER_ROLES_URL(authority.resolver)} target="_blank" rel="noreferrer">Resolver roles ↗</a>
      <details><summary className="v-cell-sub">Writer and allowed keys</summary>
        <div className="v-mono" style={{ overflowWrap: 'anywhere' }}>{authority.worker}</div>
        <div className="v-cell-sub">{authority.keys.join(', ')}</div>
      </details>
    </div>)}
    <button type="button" className="v-btn-detail" onClick={() => void verify()} disabled={state === 'loading'}>
      {state === 'loading' ? 'Checking permissions…' : 'Verify live permissions'}
    </button>
    <p className="v-cell-sub" role="status">
      {state === 'idle' && 'Evidence-name setup is not assumed. Check live permissions before relying on these links.'}
      {state === 'error' && 'Verification unavailable. No permission claim can be made.'}
      {proof && (proof.verified ? `Permission checks passed at Sepolia block ${proof.sourceBlock}. This is access-control proof, not a reserve audit.` : `Not verified at block ${proof.sourceBlock}: evidence setup or permission checks are incomplete.`)}
    </p>
    {proof && !proof.verified && <details><summary className="v-cell-sub">Checks requiring attention</summary>
      {Object.entries(proof.authorities).map(([role, authority]) => <div className="v-cell-sub" key={role}>{role}: {Object.entries(authority.checks).filter(([, passed]) => !passed).map(([key]) => key).join(', ') || 'passed'}</div>)}
    </details>}
    <p className="v-cell-sub">Permissions are text-key scoped across each dedicated resolver, not per-name. Recovery admins and registry/.eth owners can change authority. Demo keys are team-operated, not external audit firms. Quartet AI runs offchain; its summary uses one relayer.</p>
  </div>;
}
