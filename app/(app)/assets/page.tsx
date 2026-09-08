import { PageHead } from '@/components/app/app-shell';

export default function AssetsStub() {
  return (
    <>
      <PageHead title="Assets" sub="Canonical ENS identities and their current deterministic verdict." />
      <div className="v-card"><span className="v-muted">Asset table lands in Phase 2. Columns: asset · verdict · issuer · audit · risk · heartbeat · network.</span></div>
    </>
  );
}
