import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import type { QuartetRun } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

const RUNS_DIR = join(process.cwd(), '.secrets', 'agent-runs');

export async function GET() {
  try {
    const files = readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 20);
    const runs = files.map((file) => {
      const raw = readFileSync(join(RUNS_DIR, file), 'utf8');
      const run = JSON.parse(raw) as QuartetRun;
      const { mtime } = statSync(join(RUNS_DIR, file));
      return { file, recordedAt: mtime.toISOString(), run };
    });
    return NextResponse.json({ ok: true, count: runs.length, runs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: true, count: 0, runs: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
