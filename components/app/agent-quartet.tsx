'use client';

import { useCallback, useEffect, useState } from 'react';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import { INSPECTOR_STATUS_TO_POLICY, type InspectorId, type QuartetRun } from '@/lib/agents/types';

const INSPECTORS: { id: InspectorId; label: string }[] = [
  { id: 'legal', label: 'Legal & Compliance' },
  { id: 'custody', label: 'Custody & Backing' },
  { id: 'technical', label: 'Smart Contract' },
];

const OPTIONS = [
  { value: ENSV2_SEPOLIA.names.asset, label: `Demo asset · ${ENSV2_SEPOLIA.names.asset}` },
  ...DEMO_ASSETS.filter((a) => a.marketId).map((a) => ({ value: a.marketId as string, label: `${a.ticker} · ${a.title}` })),
];

type HistoryEntry = { file: string; recordedAt: string; run: QuartetRun };

function Grounding({ value }: { value: string }) {
  const cls = value === 'live' ? 'v-pass-t' : value === 'curated' ? 'v-dim' : 'v-block-t';
  return <span className={cls} style={{ fontSize: 11, textTransform: 'uppercase' }}>{value}</span>;
}

function InspectorCard({ id, label, run }: { id: InspectorId; label: string; run: QuartetRun }) {
  const report = run.reports[id];
  return (
    <div className="v-card">
      <div className="v-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
        <StatusChip state={INSPECTOR_STATUS_TO_POLICY[report.status]} />
        <span className="v-mono" style={{ fontSize: 12 }}>{report.status} · {report.score}/100</span>
      </div>
      <div className="v-metric-line" aria-hidden="true"><span style={{ width: `${report.score}%` }} /></div>
      <ul style={{ fontSize: 13, margin: '10px 0 0', paddingLeft: 18 }}>
        {report.findings.slice(0, 4).map((finding) => <li key={finding.slice(0, 60)}>{finding}</li>)}
      </ul>
      {report.evidence_urls.length > 0 && (
        <div className="v-mono" style={{ fontSize: 11, marginTop: 8 }}>
          {report.evidence_urls.slice(0, 3).map((url) => (
            <span key={url}><a href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, '').slice(0, 42)} ↗</a><br /></span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentQuartet() {
  const [subject, setSubject] = useState(OPTIONS[1]?.value ?? OPTIONS[0].value);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/agents/runs', { cache: 'no-store' });
      if (!response.ok) return;
      const body = (await response.json()) as { runs?: HistoryEntry[] };
      setHistory(body.runs ?? []);
    } catch { /* History is optional. */ }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [running]);

  async function start() {
    setRunning(true);
    setElapsed(0);
    setError(null);
    setRun(null);
    try {
      const response = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, write: false }),
      });
      const body = (await response.json()) as { ok: boolean; run?: QuartetRun; error?: string };
      if (!response.ok || !body.ok || !body.run) throw new Error(body.error ?? 'Inspection failed');
      setRun(body.run);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inspection failed');
    } finally {
      setRunning(false);
    }
  }

  const stage = elapsed < 12 ? 'Gathering live evidence (market · contract · verification · issuer page)…'
    : elapsed < 60 ? 'Inspectors running in parallel (legal · custody · technical)…'
    : 'Synthesizing consensus…';

  return (
    <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
      <div className="v-card-header">
        <div>
          <div className="v-card-tag">02 / 4-AGENT INSPECTION</div>
          <h3 className="v-section-title">Legal · Custody · Technical → Consensus</h3>
          <p className="v-muted">
            Three inspectors assess live evidence in parallel on one shared key, then the synthesizer maps
            consensus onto the deterministic policy. Inspect-only: nothing writes to chain.
          </p>
        </div>
      </div>

      <form
        className="v-table-toolbar"
        onSubmit={(event) => { event.preventDefault(); void start(); }}
      >
        <div className="v-select-wrapper" style={{ flex: 1 }}>
          <label className="v-visually-hidden" htmlFor="quartet-subject">Inspection subject</label>
          <select
            id="quartet-subject"
            className="v-select-filter"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={running}
            style={{ width: '100%' }}
          >
            {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button type="submit" className="v-btn" disabled={running} aria-busy={running}>
          {running ? `Inspecting… ${elapsed}s` : 'Run inspection'}
        </button>
      </form>

      {running && <p className="v-muted" role="status" aria-live="polite">{stage} Inspectors typically take 30–90s.</p>}
      {error && <p className="v-block-t" role="alert">{error}</p>}

      {run && (
        <>
          <div className="v-split" style={{ marginTop: 12 }}>
            {INSPECTORS.map(({ id, label }) => <InspectorCard key={id} id={id} label={label} run={run} />)}
          </div>
          <div className="v-card" style={{ marginTop: 12 }}>
            <div className="v-label">Consensus · {run.model} · {Math.round(run.durationMs / 1000)}s · {new Date(run.finishedAt).toLocaleString()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
              <StatusChip state={run.synthesis.policy_state} />
              <span className="v-mono" style={{ fontSize: 12 }}>{run.synthesis.verdict} · {run.synthesis.overall_score}/100</span>
            </div>
            <p style={{ fontSize: 14 }}>{run.synthesis.reasoning_summary}</p>
            <dl className="v-kv" style={{ marginTop: 10 }}>
              <dt>Mapped severity</dt><dd className="v-mono">{run.synthesis.mapped.severity} · {run.synthesis.mapped.reasonCode}</dd>
              <dt>Confidence</dt><dd>{run.synthesis.mapped.confidence}% · valid {run.synthesis.mapped.validityDays}d</dd>
              <dt>Contract</dt>
              <dd className="v-mono">
                {run.evidenceSummary.contractAddress ?? 'no EVM contract in evidence'}
                {run.evidenceSummary.contractVerified !== null && ` · verified ${String(run.evidenceSummary.contractVerified)}`}
                {' '}<Grounding value={run.evidenceSummary.contractAddress ? 'live' : 'unknown'} />
              </dd>
              <dt>Market</dt>
              <dd className="v-mono">
                {run.evidenceSummary.marketUsd !== null ? `$${run.evidenceSummary.marketUsd}` : 'unavailable'}
                {' '}<Grounding value={run.evidenceSummary.marketUsd !== null ? 'live' : 'unknown'} />
              </dd>
              <dt>Issuer page</dt>
              <dd className="v-mono">
                {run.evidenceSummary.issuerReachable === true ? 'reachable' : run.evidenceSummary.issuerReachable === false ? 'unreachable' : 'n/a'}
                {' '}<Grounding value={run.evidenceSummary.issuerReachable === true ? 'live' : 'unknown'} />
              </dd>
              <dt>Chain write</dt><dd>{run.write.performed ? 'written' : 'none — inspect-only'}</dd>
            </dl>
          </div>
        </>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="v-label">Run history · {history.length}</div>
          <div className="v-activity-list" style={{ marginTop: 8 }}>
            {history.slice(0, 6).map(({ file, recordedAt, run: h }) => (
              <button
                key={file}
                type="button"
                className="v-activity-item"
                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: 'transparent', border: 0 }}
                onClick={() => { setRun(h); setError(null); }}
              >
                <div className="v-activity-left">
                  <span className="v-activity-badge">{h.synthesis.verdict} · {h.synthesis.overall_score}</span>
                  <div className="v-activity-desc">{h.subject}</div>
                </div>
                <div className="v-activity-meta">
                  <span>{new Date(recordedAt).toLocaleString()}</span>
                  <span className="v-mono">{h.model}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
