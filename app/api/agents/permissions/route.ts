import { NextResponse } from 'next/server';
import { JsonRpcProvider } from 'ethers';
import { ENSV2_SEPOLIA as ENS } from '@/lib/ensv2-config';
import { quartetReportKey } from '@/lib/quartet-authority-policy';
import { verifyQuartetAuthorities } from '@/lib/quartet-authorities';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Public proof only. No keystores or signer dependencies are loaded. */
export async function GET(request: Request) {
  const assetName = new URL(request.url).searchParams.get('name') || 'buidl.rwa.verdict.eth';
  try { quartetReportKey(assetName); }
  catch { return NextResponse.json({ ok: false, error: 'Unknown canonical asset name.' }, { status: 400 }); }
  if (!process.env.SEPOLIA_RPC_URL) return NextResponse.json({ ok: false, error: 'Sepolia RPC is not configured.' }, { status: 503 });
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL, ENS.chainId);
  try {
    if (Number((await provider.getNetwork()).chainId) !== ENS.chainId) throw new Error('RPC must be Sepolia');
    const proof = await verifyQuartetAuthorities(provider, assetName);
    return NextResponse.json({ ok: true, proof }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Live quartet permission verification unavailable. No verified claim can be made.' }, { status: 502 });
  } finally { provider.destroy(); }
}
