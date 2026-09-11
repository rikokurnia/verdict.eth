import { NextResponse } from 'next/server';
import { readEnsProfile } from '@/lib/ens-profile';

export const dynamic = 'force-dynamic';

const NAME_PATTERN = /^(?=.{1,255}$)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/;

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.toLowerCase() ?? '';
  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: 'A valid lowercase .eth name is required.' }, { status: 400 });
  }
  try {
    const profile = await readEnsProfile(name);
    return NextResponse.json(profile, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('ENS profile read failed', error);
    return NextResponse.json({ ok: false, name, sourceBlock: null }, { status: 502 });
  }
}
