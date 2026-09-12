import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import type { QuartetRun } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

const RUNS_DIR = process.env.VERCEL
  ? join('/tmp', 'verdict-agent-runs')
  : join(process.cwd(), '.secrets', 'agent-runs');

// Bundled full transcripts, committed to git. Vercel's /tmp is ephemeral per
// instance and .secrets/ is gitignored, so without this the inspect page falls
// back to the 1-summary onchain snapshot on production.
const BUNDLED_DIR = join(process.cwd(), 'data', 'agent-runs');

function readDirEntries(dir: string, useMtime: boolean) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 200)
      .map((file) => {
        const raw = readFileSync(join(dir, file), 'utf8');
        const run = JSON.parse(raw) as QuartetRun;
        if (!run?.subject || !run?.finishedAt) return null;
        const recordedAt = useMtime
          ? statSync(join(dir, file)).mtime.toISOString()
          : run.finishedAt;
        return { file, recordedAt, run };
      })
      .filter((e): e is { file: string; recordedAt: string; run: QuartetRun } => e !== null);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    // Dedupe by subject, newest first: every inspected asset stays visible
    // no matter how many runs accumulate (a flat newest-N window drops old
    // subjects and diverges from the dashboard).
    const bySubject = new Map<string, { file: string; recordedAt: string; run: QuartetRun }>();
    // Bundled first, ephemeral live runs override when newer.
    for (const entry of [...readDirEntries(BUNDLED_DIR, false), ...readDirEntries(RUNS_DIR, true)]) {
      try {
        const prev = bySubject.get(entry.run.subject);
        if (!prev || prev.run.finishedAt < entry.run.finishedAt) bySubject.set(entry.run.subject, entry);
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
