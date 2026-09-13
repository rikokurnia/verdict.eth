'use client';

import { ArrowUpRight } from 'lucide-react';
import { EnsLogo } from '@/components/app/asset-identity';
import { ENSV2_SEPOLIA, ENS_EXPLORER_NAME_URL } from '@/lib/ensv2-config';

export type ProofTx = { hash: string; blockNumber: number };

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

/**
 * Agent identifier with onchain transaction proof:
 * avatar logo · ENS identifier · tx links · ENS Explorer logo + link.
 */
export function AgentIdentityProof({
  subname,
  owner,
  registerTx,
  recordsTx,
  avatar = '/assets/agent-assets/plane1.png',
  compact = false,
}: {
  subname: string;
  owner?: string;
  registerTx?: ProofTx | null;
  recordsTx?: ProofTx | null;
  avatar?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="v-agent-proof"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      <img
        src={avatar}
        alt=""
        width={compact ? 30 : 38}
        height={compact ? 30 : 38}
        loading="lazy"
        style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
      />
      <span
        className="v-mono"
        style={{ fontSize: compact ? 12 : 13, overflowWrap: 'anywhere' }}
        title={`Agent identity: ${subname}`}
      >
        {subname}
      </span>
      {owner && (
        <span className="v-cell-sub v-mono" style={{ fontSize: 11 }} title={`Owner ${owner}`}>
          {shortHash(owner)}
        </span>
      )}
      {(registerTx || recordsTx) && (
        <span className="v-cell-sub v-mono" style={{ fontSize: 11, display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
          {registerTx && (
            <a href={`${ENSV2_SEPOLIA.explorer}/tx/${registerTx.hash}`} target="_blank" rel="noreferrer" title={`Register tx ${registerTx.hash} · block ${registerTx.blockNumber}`}>
              reg {shortHash(registerTx.hash)} ↗
            </a>
          )}
          {recordsTx && (
            <a href={`${ENSV2_SEPOLIA.explorer}/tx/${recordsTx.hash}`} target="_blank" rel="noreferrer" title={`Records tx ${recordsTx.hash} · block ${recordsTx.blockNumber}`}>
              policy {shortHash(recordsTx.hash)} ↗
            </a>
          )}
        </span>
      )}
      <a
        href={ENS_EXPLORER_NAME_URL(subname)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${subname} in the ENSv2 Explorer`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: compact ? 12 : 13 }}
      >
        <EnsLogo size={14} />
        <span>ENS Explorer</span>
        <ArrowUpRight size={12} aria-hidden="true" />
      </a>
    </div>
  );
}
