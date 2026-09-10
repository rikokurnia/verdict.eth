import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { readLifecycleProofs } from '@/lib/lifecycle-proofs';
import { resolveVerdict, unavailableVerdict } from '@/lib/verdict-service';

export const dynamic = 'force-dynamic';

function short(value: string) {
  return value.length > 24 ? `${value.slice(0, 14)}…${value.slice(-8)}` : value;
}

export default async function DebugPage() {
  const verdict = await resolveVerdict().catch(() => unavailableVerdict(ENSV2_SEPOLIA.names.asset, 'Sepolia read failed.'));
  const proofs = await readLifecycleProofs().catch(() => null);
  const txs = [
    ['Asset records', ENSV2_SEPOLIA.transactions.assetRecords],
    ['Audit records', ENSV2_SEPOLIA.transactions.auditRecords],
    ['Risk records', ENSV2_SEPOLIA.transactions.observationRecords],
    ['Agent records', ENSV2_SEPOLIA.transactions.agentRecords],
  ] as const;

  return (
    <>
      <PageHead title="Resolution debug" sub="Raw ENSv2 sources, pinned block, resolver addresses, and deployment proofs." />
      <div className="v-split">
        <div className="v-card">
          <div className="v-label">Pinned resolution</div>
          <div style={{ margin: '12px 0' }}><StatusChip state={verdict.state} /></div>
          <dl className="v-kv">
            <dt>Name</dt><dd className="v-mono">{verdict.name}</dd>
            <dt>Block</dt><dd className="v-mono">{verdict.sourceBlock ?? 'unavailable'}</dd>
            <dt>Chain</dt><dd className="v-mono">{verdict.chainId}</dd>
            <dt>Policy</dt><dd className="v-mono">{verdict.policyId}</dd>
            <dt>Universal resolver</dt><dd className="v-mono">{short(verdict.infrastructure.universalResolver)}</dd>
          </dl>
        </div>
        <div className="v-card">
          <div className="v-label">Policy inputs</div>
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Available</dt><dd>{String(verdict.evidence.available)}</dd>
            <dt>Audit days</dt><dd>{verdict.evidence.daysRemaining}</dd>
            <dt>Revoked</dt><dd>{String(verdict.evidence.revoked)}</dd>
            <dt>Risk fresh</dt><dd>{String(verdict.evidence.fresh)}</dd>
            <dt>Risk conflict</dt><dd>{String(verdict.evidence.riskConflict)}</dd>
          </dl>
        </div>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Resolved authority sources</div>
        <div className="v-table-wrap" style={{ marginTop: 10 }}>
          <table className="v-table">
            <thead><tr><th>ENS name</th><th>Resolver proxy</th><th>Records read</th></tr></thead>
            <tbody>
              {verdict.sources.map((source) => (
                <tr key={source.name}>
                  <td className="v-mono">{source.name}</td>
                  <td className="v-mono">{short(source.resolver)}</td>
                  <td>{Object.keys(source.records).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Sepolia transaction proofs</div>
        <dl className="v-kv" style={{ marginTop: 10 }}>
          {txs.map(([label, hash]) => (
            <div key={hash} style={{ display: 'contents' }}>
              <dt>{label}</dt>
              <dd><a className="v-mono" href={`${ENSV2_SEPOLIA.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{short(hash)}</a></dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Namespace aliasing · edit once, both resolve</div>
        {!proofs ? <p className="v-muted">Alias proofs unavailable.</p> : (
          <div className="v-table-wrap" style={{ marginTop: 10 }}>
            <table className="v-table">
              <thead><tr><th>Alias path</th><th>Shared subregistry</th><th>Direct read</th><th>Via pointer</th><th>Identical</th></tr></thead>
              <tbody>
                {proofs.aliases.map((alias) => (
                  <tr key={alias.parent}>
                    <td className="v-mono">{alias.path}</td>
                    <td>{alias.sharesSubregistry ? '✓ shared' : '× missing'}</td>
                    <td className="v-mono">{alias.pathTitle === '' ? '(empty — no setAlias here)' : alias.pathTitle}</td>
                    <td className="v-mono">{alias.followedTitle || '—'}</td>
                    <td>{alias.identical ? `✓ matches canonical` : '× divergent'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="v-muted" style={{ marginTop: 8 }}>
          arb./base. share the acme subregistry and declare their canonical target onchain; readers follow
          the pointer (this deployment predates resolver setAlias — proven by implementation ABI).
        </p>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Lifecycle artifacts · soulbound, forever, emancipated</div>
        {!proofs ? <p className="v-muted">Artifact proofs unavailable.</p> : (
          <dl className="v-kv" style={{ marginTop: 10 }}>
            <dt>Soulbound</dt><dd className="v-mono">{proofs.soulbound?.name} · owner {short(proofs.soulbound?.owner ?? '')} · transfer {proofs.soulbound?.blocked ? 'blocked ✓ (no transfer admin)' : 'NOT blocked'}</dd>
            <dt>Forever</dt><dd className="v-mono">{proofs.forever?.name} · expiry {proofs.forever?.expiry} {proofs.forever?.isMax ? '✓ uint64 max' : ''}</dd>
            <dt>Emancipation</dt><dd className="v-mono">{proofs.emancipation?.registry} · dangerous root roles {proofs.emancipation?.dangerousHeld ? 'HELD' : 'revoked ✓'} · registrar {proofs.emancipation?.registrarHeld ? 'kept ✓' : 'lost'}</dd>
          </dl>
        )}
      </div>
    </>
  );
}
