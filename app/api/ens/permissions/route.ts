import { NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { verifyAssetPermissions } from '@/lib/ens-permissions';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name') || '';
  if (!DEMO_ASSETS.some((asset) => asset.name === name && asset.name.endsWith('.rwa.verdict.eth'))) {
    return NextResponse.json({ ok: false, error: 'Unknown canonical RWA asset.' }, { status: 400 });
  }
  if (!process.env.SEPOLIA_RPC_URL) return NextResponse.json({ ok: false, error: 'Sepolia RPC is not configured.' }, { status: 503 });
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL, ENSV2_SEPOLIA.chainId);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENSV2_SEPOLIA.chainId) throw new Error('Wrong RPC chain');
    const proof = await verifyAssetPermissions(provider, name);
    return NextResponse.json({ ok: true, proof }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Live permission verification unavailable. No permission claim can be made.' }, { status: 502 });
  } finally { provider.destroy(); }
}
