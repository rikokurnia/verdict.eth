import { NextResponse } from 'next/server';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { isDemoAssetSubject, runQuartet } from '@/lib/agents/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MARKET_IDS = new Set(DEMO_ASSETS.flatMap((a) => (a.marketId ? [a.marketId] : [])));

export async function POST(request: Request) {
  let body: { subject?: string; write?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const write = body.write === true;
  if (!subject) return NextResponse.json({ error: 'subject is required.' }, { status: 400 });
  const isDemo = isDemoAssetSubject(subject);
  const isCatalog = MARKET_IDS.has(subject);
  if (!isDemo && !isCatalog) {
    return NextResponse.json(
      { error: 'subject must be a catalog marketId or the ENS demo asset.' },
      { status: 400 },
    );
  }
  if (write && !isDemo) {
    return NextResponse.json({ error: 'Writes are only enabled for the ENS demo asset.' }, { status: 400 });
  }
  try {
    const run = await runQuartet(isDemo ? ENSV2_SEPOLIA.names.asset : subject, write);
    return NextResponse.json({ ok: true, run }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Quartet run failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Inspection failed.' },
      { status: 502 },
    );
  }
}
