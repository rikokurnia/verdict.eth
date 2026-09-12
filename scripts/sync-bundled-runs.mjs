import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Dedupe .secrets/agent-runs by subject (newest finishedAt wins) into
// data/agent-runs/<marketId>.json so Vercel can serve full 4-agent
// transcripts without relying on ephemeral /tmp.
const ROOT = process.cwd();
const SRC = join(ROOT, '.secrets', 'agent-runs');
const DST = join(ROOT, 'data', 'agent-runs');

mkdirSync(DST, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith('.json'));
const best = new Map();
for (const file of files) {
  const run = JSON.parse(readFileSync(join(SRC, file), 'utf8'));
  if (!run?.subject || !run?.finishedAt) continue;
  const prev = best.get(run.subject);
  if (!prev || prev.run.finishedAt < run.finishedAt) best.set(run.subject, { file, run });
}
for (const [subject, { file }] of [...best.entries()].sort()) {
  copyFileSync(join(SRC, file), join(DST, `${subject}.json`));
  console.log(`${subject} <- ${file}`);
}
console.log(`synced ${best.size} subjects from ${files.length} runs`);
