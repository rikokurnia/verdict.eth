import { PageHead } from '@/components/app/app-shell';

export default function Page() {
  return (
    <>
      <PageHead title="Settings" sub="Network and display preferences. Minimal." />
      <div className="v-card">
        <div className="v-label">Network</div>
        <p style={{ fontSize: 14, margin: '8px 0' }}>Sepolia · ENSv2 hackathon deployment. Resolver override pinned in config.</p>
      </div>
      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Demo data</div>
        <p style={{ fontSize: 14, margin: '8px 0' }}>Pages render labeled demo data until contract phase wires live Sepolia reads. Motion follows your system reduced-motion setting.</p>
      </div>
    </>
  );
}
