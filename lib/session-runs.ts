import type { QuartetRun } from '@/lib/agents/types';

/**
 * Per-browser session store for quartet runs.
 *
 * A fresh 4-agent inspection is inspect-only (no chain write), so the server
 * has no durable global record of it on Vercel (/tmp is per-instance). The
 * user's own browser keeps their latest run per subject in localStorage, and
 * the agents page / inspect page / dashboard merge it in locally. Other
 * users never see it.
 */

const KEY = 'verdict:session-runs:v1';
export const SESSION_RUN_EVENT = 'verdict:session-run';

function readMap(): Record<string, QuartetRun> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, QuartetRun>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** All session runs, newest first. */
export function loadSessionRuns(): QuartetRun[] {
  return Object.values(readMap())
    .filter((r) => r?.subject && r?.finishedAt)
    .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
}

export function findSessionRun(subject: string): QuartetRun | null {
  try {
    return readMap()[subject.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/** Keep only the newest run per subject; notifies same-tab listeners. */
export function saveSessionRun(run: QuartetRun): QuartetRun[] {
  try {
    const map = readMap();
    const prev = map[run.subject.toLowerCase()];
    if (!prev || prev.finishedAt <= run.finishedAt) {
      map[run.subject.toLowerCase()] = run;
      try {
        window.localStorage.setItem(KEY, JSON.stringify(map));
      } catch {
        // Quota or privacy mode — session preview degrades to in-memory only.
      }
    }
  } catch {
    // localStorage unavailable — callers already hold the run in memory.
  }
  try {
    window.dispatchEvent(new CustomEvent(SESSION_RUN_EVENT, { detail: run }));
  } catch {
    // Event dispatch is best-effort.
  }
  return loadSessionRuns();
}
