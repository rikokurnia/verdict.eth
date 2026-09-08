import { PageHead } from '@/components/app/app-shell';

export default function Page() {
  return (
    <>
      <PageHead title="Activity" sub="ENS writes, attestations, reverts, state transitions. Phase 4." />
      <div className="v-card"><span className="v-muted">Audit-trail event rows land here.</span></div>
    </>
  );
}
