import { NextResponse } from 'next/server';
import { validCustomAgentName } from '@/lib/custom-agent-store';
import { readAgentBranch } from '@/lib/agents/factory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const name = (new URL(request.url).searchParams.get('name') || '').trim().toLowerCase();
  if (!validCustomAgentName(name)) return NextResponse.json({ ok: false, error: 'Invalid custom agent name.' }, { status: 400 });
  if (!process.env.SEPOLIA_RPC_URL) return NextResponse.json({ ok: false, error: 'Sepolia RPC is not configured.' }, { status: 503 });
  try {
    const agent = await readAgentBranch(name);
    if (!agent.policy.trim()) return NextResponse.json({ ok: false, error: 'This name has no usable ENS agent.policy record.' }, { status: 422 });
    return NextResponse.json({ ok: true, agent: { name, ...agent } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not verify an active custom agent and its ENS policy. Retry or deploy an agent above.' }, { status: 502 });
  }
}
