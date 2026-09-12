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
      .slice(0, 200);
    // Dedupe by subject, newest first: every inspected asset stays visible
    // no matter how many runs accumulate (a flat newest-N window drops old
    // subjects and diverges from the dashboard).
    const bySubject = new Map<string, { file: string; recordedAt: string; run: QuartetRun }>();
    for (const file of files) {
      try {
        const raw = readFileSync(join(RUNS_DIR, file), 'utf8');
        const run = JSON.parse(raw) as QuartetRun;
        const { mtime } = statSync(join(RUNS_DIR, file));
        const entry = { file, recordedAt: mtime.toISOString(), run };
        const prev = bySubject.get(run.subject);
        if (!prev || prev.run.finishedAt < run.finishedAt) bySubject.set(run.subject, entry);
      } catch {
        // Skip unreadable entries.
      }
    }
    const runs = [...bySubject.values()].sort((a, b) => (a.run.finishedAt < b.run.finishedAt ? 1 : -1));
    return NextResponse.json({ ok: true, count: runs.length, runs }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: true, count: 0, runs: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
