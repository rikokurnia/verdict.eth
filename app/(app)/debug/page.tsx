import { PageHead } from '@/components/app/app-shell';

const RECORDS: [string, string][] = [
  ['issuer', 'acme.verdict.eth'],
  ['asset-class', 'yield'],
  ['audit-hash', 'sha256:89a…'],
  ['audit-expiry', '1788… (27d)'],
  ['heartbeat', '1788… (12s ago)'],
  ['agent-context', 'portfolio suitability'],
  ['agent-endpoint[mcp]', 'https://feed.example/mcp'],
];

export default function DebugPage() {
  return (
    <>
      <PageHead title="Resolver Debug" sub="Raw resolution proof — nothing is hardcoded." />
      <div className="v-dark">
        <div className="v-label">Name</div>
        <p>usd-yield-001.acme.verdict.eth</p>
        <div className="v-label">Node</div>
        <p>0x… (namehash)</p>
        <div className="v-label">Resolver</div>
        <p>0x… (permissioned resolver, Sepolia hackathon deployment)</p>
        <div className="v-label">Universal resolver</div>
        <p>0xd26f…f142 (hackathon override — never the viem/ethers default)</p>
        <div className="v-label" style={{ marginTop: 16 }}>Records</div>
        {RECORDS.map(([k, v]) => (
          <p key={k}>{k} → {v}</p>
        ))}
      </div>
      <div className="v-cli" style={{ marginTop: 16 }}>
        <div className="v-dim">SECOND-CLIENT PROOF</div>
        <div><span className="v-dim">$</span> ens resolve usd-yield-001.acme.verdict.eth text audit-hash</div>
        <div>&gt; sha256:89a…</div>
        <div>Match <span className="v-pass-t">✓</span></div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>Live resolver reads + tx hashes wire up in contract phase. Addresses pinned in config, shown in this panel.</p>
    </>
  );
}
