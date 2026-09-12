import { redirect } from 'next/navigation';
import { DEMO_ASSETS } from '@/components/app/demo-data';

export default async function AssetLegacyRedirect({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name).toLowerCase();
  const hit = DEMO_ASSETS.find(
    (a) =>
      a.name.toLowerCase() === decoded ||
      a.marketId?.toLowerCase() === decoded ||
      a.ticker.toLowerCase() === decoded
  );

  if (hit?.marketId) {
    redirect(`/agents/inspect/${encodeURIComponent(hit.marketId)}`);
  }
  redirect('/dashboard');
}
