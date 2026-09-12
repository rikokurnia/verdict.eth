# Bundled agent transcripts (Vercel-safe)

`data/agent-runs/<marketId>.json` holds the newest full `QuartetRun` per
catalog asset (legal + custody + technical + synthesis).

Why this exists: `/api/agents/runs` used to read only
`.secrets/agent-runs/` locally and `/tmp/verdict-agent-runs` on Vercel.
`.secrets/` is gitignored and `/tmp` is ephemeral per function instance, so
production always returned `{runs: []}` and
`app/(app)/agents/inspect/[subject]/page.tsx` fell back to the 1-summary
onchain snapshot (`verdict.quartet.*`) instead of the full 4-agent
`RunDetails` view.

The runs API now merges `data/agent-runs/` (committed, always available)
with the ephemeral dir (live runs win when newer).

Refresh after new local inspections:

```bash
npm run sync:runs
```

That dedupes `.secrets/agent-runs/` by subject (newest `finishedAt` wins)
into this folder. Commit the result. Files contain only public scores,
findings, and evidence URLs — no API keys or wallets.
