import { PageHead } from '@/components/app/app-shell';

export default function Page() {
  return (
    <>
      <PageHead title="Settings" sub="Network and display preferences. Minimal." />
      <div className="v-card"><span className="v-muted">Network: Sepolia · ENS deployment pinned in config.</span></div>
    </>
  );
}
