import { NextResponse } from 'next/server';
import { readLifecycleProofs } from '@/lib/lifecycle-proofs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const proofs = await readLifecycleProofs();
    return NextResponse.json(proofs, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Lifecycle proofs unavailable', error);
    return NextResponse.json({ ok: false, sourceBlock: null }, { status: 502 });
  }
}
