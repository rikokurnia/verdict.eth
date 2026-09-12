import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import {
  ENSV2_SEPOLIA,
  ENS_EXPLORER_NAME_URL,
  ENS_NAME_HISTORY_URL,
  ENS_NAME_RECORDS_URL,
  ENS_NAME_REGISTRY_URL,
  ENS_NAME_RESOLVER_URL,
  ENS_REGISTRY_URL,
  ENS_RESOLVER_ROLES_URL,
  ENS_RESOLVER_URL,
} from '@/lib/ensv2-config';
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
            <dt>Name</dt><dd className="v-mono"><a href={ENS_EXPLORER_NAME_URL(verdict.name)} target="_blank" rel="noreferrer">{verdict.name} ↗</a></dd>
            <dt>Block</dt><dd className="v-mono">{verdict.sourceBlock ?? 'unavailable'}</dd>
            <dt>Chain</dt><dd className="v-mono">{verdict.chainId}</dd>
            <dt>Policy</dt><dd className="v-mono">{verdict.policyId}</dd>
            <dt>Universal resolver</dt><dd className="v-mono"><a href={ENS_RESOLVER_URL(verdict.infrastructure.universalResolver)} target="_blank" rel="noreferrer">{short(verdict.infrastructure.universalResolver)} ↗</a></dd>
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
            <thead><tr><th>ENS name</th><th>Resolver proxy</th><th>Records read</th><th>Explorer proof</th></tr></thead>
            <tbody>
              {verdict.sources.map((source) => (
                <tr key={source.name}>
                  <td className="v-mono"><a href={ENS_EXPLORER_NAME_URL(source.name)} target="_blank" rel="noreferrer">{source.name} ↗</a></td>
                  <td className="v-mono"><a href={ENS_RESOLVER_URL(source.resolver)} target="_blank" rel="noreferrer">{short(source.resolver)} ↗</a></td>
                  <td>{Object.keys(source.records).length}</td>
                  <td>
                    <a href={ENS_NAME_RECORDS_URL(source.name)} target="_blank" rel="noreferrer">Records ↗</a>
                    {' · '}<a href={ENS_RESOLVER_ROLES_URL(source.resolver)} target="_blank" rel="noreferrer">Roles ↗</a>
                    {' · '}<a href={ENS_NAME_HISTORY_URL(source.name)} target="_blank" rel="noreferrer">History ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">ENSv2 deployment proof</div>
        <p className="v-muted" style={{ marginTop: 10 }}>
          These links use the dedicated ETHOnline ENSv2 Explorer. Blockscout links below prove the raw Sepolia transactions.
        </p>
        <dl className="v-kv" style={{ marginTop: 10 }}>
          <dt>Asset records</dt><dd><a href={ENS_NAME_RECORDS_URL(ENSV2_SEPOLIA.names.asset)} target="_blank" rel="noreferrer">Open records ↗</a></dd>
          <dt>Asset resolver</dt><dd><a href={ENS_NAME_RESOLVER_URL(ENSV2_SEPOLIA.names.asset)} target="_blank" rel="noreferrer">Open resolver ↗</a></dd>
          <dt>Asset registry</dt><dd><a href={ENS_NAME_REGISTRY_URL(ENSV2_SEPOLIA.names.asset)} target="_blank" rel="noreferrer">Open hierarchy ↗</a></dd>
          <dt>Auditor EAC roles</dt><dd><a href={ENS_RESOLVER_ROLES_URL(ENSV2_SEPOLIA.proxies.auditorResolver)} target="_blank" rel="noreferrer">Open resolver roles ↗</a></dd>
          <dt>Monitor EAC roles</dt><dd><a href={ENS_RESOLVER_ROLES_URL(ENSV2_SEPOLIA.proxies.monitorResolver)} target="_blank" rel="noreferrer">Open resolver roles ↗</a></dd>
          <dt>Verdict registry</dt><dd><a href={ENS_REGISTRY_URL(ENSV2_SEPOLIA.proxies.verdictRegistry)} target="_blank" rel="noreferrer">Open registry contract ↗</a></dd>
        </dl>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Sepolia transaction proofs</div>
        <dl className="v-kv" style={{ marginTop: 10 }}>
          {txs.map(([label, hash]) => (
            <div key={hash} style={{ display: 'contents' }}>
              <dt>{label}</dt>
              <dd><a className="v-mono" href={`${ENSV2_SEPOLIA.explorer}/tx/${hash}`} target="_blank" rel="noreferrer">{short(hash)} ↗</a></dd>
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
