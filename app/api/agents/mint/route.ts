import { NextResponse } from 'next/server';
import {
  mintAuditorBranch,
  mintMessage,
  parseMintMessage,
  subnameStatus,
  validLabel,
  verifyMintSignature,
} from '@/lib/agents/factory';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_POLICY_CHARS = 2000;
const MIN_MESSAGE_AGE_MS = 15 * 60 * 1000;

// Light anti-spam: max 5 mints per hour per client IP (best-effort, in-memory).
const buckets = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const window = (buckets.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (window.length >= 5) return true;
  buckets.set(ip, [...window, now]);
  return false;
}

function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** Availability + branch preview: GET /api/agents/mint?label=foo */
export async function GET(request: Request) {
  const label = (new URL(request.url).searchParams.get('label') ?? '').toLowerCase();
  if (!validLabel(label)) {
    return NextResponse.json({ ok: false, error: 'Lowercase letters, digits, hyphens; 1–32 chars.' }, { status: 400 });
  }
  try {
    const status = await subnameStatus(label);
    return NextResponse.json(
      { ok: true, label, subname: `${label}.verdict.eth`, ...status },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Mint availability check failed', error);
    return NextResponse.json({ ok: false, error: 'Registry read unavailable.' }, { status: 502 });
  }
}

/** Sponsored mint: user signs (no gas), operator wallet registers + writes. */
export async function POST(request: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Sponsored ENS writes are disabled on this deployment.' },
      { status: 503 },
    );
  }

  let body: { label?: string; policy?: string; address?: string; message?: string; signature?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const label = (body.label ?? '').toLowerCase();
  const policy = typeof body.policy === 'string' ? body.policy.slice(0, MAX_POLICY_CHARS) : '';
  const address = body.address ?? '';
  const message = body.message ?? '';
  const signature = body.signature ?? '';

  if (!validLabel(label)) return NextResponse.json({ error: 'Invalid subname label.' }, { status: 400 });
  if (policy.trim().length < 20) return NextResponse.json({ error: 'Policy needs at least 20 characters.' }, { status: 400 });
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: 'Invalid owner address.' }, { status: 400 });
  if (rateLimited(clientIp(request))) {
    return NextResponse.json({ error: 'Too many mints from this client. Try again later.' }, { status: 429 });
  }

  const parsed = parseMintMessage(message);
  if (!parsed || parsed.label !== label || parsed.address.toLowerCase() !== address.toLowerCase()) {
    return NextResponse.json({ error: 'Signed message does not match this mint request.' }, { status: 400 });
  }
  const age = Date.now() - Date.parse(parsed.timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MIN_MESSAGE_AGE_MS) {
    return NextResponse.json({ error: 'Signature expired. Sign again.' }, { status: 400 });
  }
  const expected = mintMessage(parsed.label, parsed.address, parsed.timestamp);
  if (expected !== message.trim()) {
    return NextResponse.json({ error: 'Signed message was modified.' }, { status: 400 });
  }
  try {
    verifyMintSignature(message, signature, address);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Bad signature.' }, { status: 400 });
  }

  try {
    const result = await mintAuditorBranch(label, address, policy);
    return NextResponse.json({ ok: true, mint: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Auditor mint failed', error);
    const messageText = error instanceof Error ? error.message : 'Mint failed.';
    const status = /available|Signature|configured|secret/i.test(messageText) ? 400 : 502;
    return NextResponse.json({ ok: false, error: messageText }, { status });
  }
}
