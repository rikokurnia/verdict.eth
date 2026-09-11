import { NextResponse } from 'next/server';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { resolveVerdict, unavailableVerdict } from '@/lib/verdict-service';

export const dynamic = 'force-dynamic';

const NAME_PATTERN = /^(?=.{1,255}$)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/;

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name')?.toLowerCase() ?? ENSV2_SEPOLIA.names.asset;
  if (!NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: 'A valid lowercase .eth name is required.' }, { status: 400 });
  }

  try {
    const result = await resolveVerdict(name);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('ENSv2 verdict resolution failed', error);
    const hint = name.endsWith('.rwa.verdict.eth')
      ? 'This is a registry profile, not a verdict asset — open its onchain profile page for live ENS records.'
      : 'Inspect the source block and retry.';
    return NextResponse.json(
      unavailableVerdict(name, hint),
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
