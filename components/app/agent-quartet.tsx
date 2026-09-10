'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
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
  { value: ENSV2_SEPOLIA.names.asset, ticker: 'USDY-001', label: 'USD Yield 001 · demo asset', logo: '/icon.svg' },
  ...DEMO_ASSETS.filter((a) => a.marketId).map((a) => ({
    value: a.marketId as string,
    ticker: a.ticker,
    label: `${a.title}`,
    logo: a.logo,
  })),
];

type HistoryEntry = { file: string; recordedAt: string; run: QuartetRun };
type TermLine = { ts: string; kind: string; label: string; detail?: string; ms?: number };

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<'official' | 'custom'>('official');
  const [customSubname, setCustomSubname] = useState('');
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const termRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const selected = OPTIONS.find((o) => o.value === subject) ?? OPTIONS[0];

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
    try {
      const remembered = localStorage.getItem('verdict-custom-agent');
      if (remembered) {
        setCustomSubname(remembered);
        setMode('custom');
      }
    } catch { /* storage optional */ }
    function onMinted(event: Event) {
      const subname = (event as CustomEvent<string>).detail;
      if (typeof subname === 'string' && subname) {
        setCustomSubname(subname);
        setMode('custom');
      }
    }
    window.addEventListener('verdict:auditor-minted', onMinted);
    return () => window.removeEventListener('verdict:auditor-minted', onMinted);
  }, []);

  useEffect(() => {
    const term = termRef.current;
    if (term) term.scrollTop = term.scrollHeight;
  }, [lines, running]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  useEffect(() => () => { sourceRef.current?.close(); }, []);

  function appendLine(entry: { t?: string; kind: string; label: string; detail?: string; ms?: number }) {
    setLines((prev) => [...prev, { ts: clock(entry.t ?? new Date().toISOString()), kind: entry.kind, label: entry.label, detail: entry.detail, ms: entry.ms }]);
  }

  function start() {
    const custom = customSubname.trim().toLowerCase();
    if (mode === 'custom' && !/^(?=.{1,255}$)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/.test(custom)) {
      setError('Enter your auditor subname (e.g. zero-risk.verdict.eth) for custom mode.');
      return;
    }
    sourceRef.current?.close();
    setRunning(true);
    setError(null);
    setRun(null);
    setLines([]);
    appendLine({ kind: 'run-start', label: `$ inspect ${subject}${mode === 'custom' ? ` through ${custom}` : ''}` });
    const params = new URLSearchParams({ subject, mode });
    if (mode === 'custom') params.set('agentSubname', custom);
    const source = new EventSource(`/api/agents/stream?${params.toString()}`);
    sourceRef.current = source;
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          kind: string; label?: string; detail?: string; ms?: number; t?: string; run?: QuartetRun;
        };
        if (data.kind === 'result' && data.run) {
          setRun(data.run);
          setRunning(false);
          source.close();
          void loadHistory();
          return;
        }
        if (data.kind === 'error') {
          setError(data.detail ?? data.label ?? 'Inspection failed');
          setRunning(false);
          source.close();
          return;
        }
        appendLine({ t: data.t, kind: data.kind, label: data.label ?? data.kind, detail: data.detail, ms: data.ms });
      } catch {
        setError('Unreadable stream frame.');
        setRunning(false);
        source.close();
      }
    };
    source.onerror = () => {
      if (sourceRef.current === source) {
        setError('Stream interrupted. Retry when connectivity returns.');
        setRunning(false);
      }
      source.close();
    };
  }

  return (
    <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 16 }}>
      <div className="v-card-header">
        <div>
          <div className="v-card-tag">03 / 4-AGENT INSPECTION</div>
          <h3 className="v-section-title">Legal · Custody · Technical → Consensus</h3>
          <p className="v-muted">
            Three inspectors assess live evidence in parallel on one shared key, then the synthesizer maps
            consensus onto the deterministic policy. Inspect-only: nothing writes to chain.
          </p>
        </div>
      </div>

      <div className="v-table-toolbar">
        <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Inspection mode">
          <button
            type="button"
            className={`v-btn ${mode === 'official' ? '' : 'v-btn-secondary'}`.trim()}
            aria-pressed={mode === 'official'}
            disabled={running}
            onClick={() => setMode('official')}
          >
            Mode A · Official Quartet
          </button>
          <button
            type="button"
            className={`v-btn ${mode === 'custom' ? '' : 'v-btn-secondary'}`.trim()}
            aria-pressed={mode === 'custom'}
            disabled={running}
            onClick={() => setMode('custom')}
            title={customSubname || 'Mint an auditor below, then run through its lens'}
          >
            Mode B · Custom{customSubname ? ` (${customSubname.split('.')[0]})` : ''}
          </button>
        </div>
      </div>
      {mode === 'custom' && (
        <div className="v-table-search-box" style={{ marginTop: 10 }}>
          <label className="v-visually-hidden" htmlFor="quartet-custom-subname">Custom auditor subname</label>
          <input
            id="quartet-custom-subname"
            className="v-search-input"
            style={{ fontFamily: 'var(--font-mono)' }}
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="zero-risk.verdict.eth"
            value={customSubname}
            onChange={(event) => setCustomSubname(event.target.value.toLowerCase())}
            disabled={running}
          />
        </div>
      )}

      <div className="v-table-toolbar" style={{ marginTop: mode === 'custom' ? 10 : 0 }}>
        <div className="v-asset-picker" ref={pickerRef}>
          <button
            type="button"
            className="v-asset-picker-btn"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-label="Inspection subject"
            disabled={running}
            onClick={() => setPickerOpen((open) => !open)}
          >
            <img src={selected.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" />
            <span className="v-asset-picker-label"><strong>{selected.ticker}</strong> · {selected.label}</span>
            <ChevronDown size={15} className="v-asset-picker-chev" aria-hidden="true" />
          </button>
          {pickerOpen && (
            <ul className="v-asset-picker-list" role="listbox" aria-label="Inspection subject">
              {OPTIONS.map((option) => (
                <li key={option.value} role="option" aria-selected={option.value === subject}>
                  <button
                    type="button"
                    className="v-asset-picker-opt"
                    aria-selected={option.value === subject}
                    onClick={() => { setSubject(option.value); setPickerOpen(false); }}
                  >
                    <img src={option.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" />
                    <span className="v-asset-picker-ticker">{option.ticker}</span>
                    <span className="v-asset-picker-name">{option.label}</span>
                    {option.value === subject && <Check size={14} aria-hidden="true" style={{ marginLeft: 'auto' }} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="v-btn" onClick={start} disabled={running} aria-busy={running}>
          {running ? 'Inspecting…' : 'Run inspection'}
        </button>
      </div>

      {(running || lines.length > 0) && (
        <div ref={termRef} className="v-cli v-term" style={{ marginTop: 12 }} role="log" aria-live="polite" aria-label="Live inspection log">
          {lines.map((line, i) => (
            <div key={`${line.ts}-${i}`}>
              <span className="v-term-ts">{line.ts}</span>
              <span className={line.kind === 'error' ? 'v-block-t' : line.kind === 'done' || line.kind === 'inspector-ok' || line.kind === 'synthesis-ok' ? 'v-pass-t' : undefined}>
                {line.label}
              </span>
              {line.detail && <span className="v-dim"> · {line.detail}</span>}
              {typeof line.ms === 'number' && <span className="v-dim"> · {line.ms >= 1000 ? `${(line.ms / 1000).toFixed(1)}s` : `${line.ms}ms`}</span>}
            </div>
          ))}
          {running && <div><span className="v-term-ts">{clock(new Date().toISOString())}</span><span className="v-term-cursor" aria-hidden="true" /></div>}
        </div>
      )}
      {error && <p className="v-block-t" role="alert">{error}</p>}

      {run && (
        <>
          <div className="v-split" style={{ marginTop: 12 }}>
            {INSPECTORS.map(({ id, label }) => <InspectorCard key={id} id={id} label={label} run={run} />)}
          </div>
          <div className="v-card" style={{ marginTop: 12 }}>
            <div className="v-label">
              Consensus · {(run.mode ?? 'official') === 'custom' ? `custom lens ${run.customPolicy?.subname ?? ''}` : 'official quartet'} · {run.model} · {Math.round(run.durationMs / 1000)}s · {new Date(run.finishedAt).toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
              <StatusChip state={run.synthesis.policy_state} />
              <span className="v-mono" style={{ fontSize: 12 }}>{run.synthesis.verdict} · {run.synthesis.overall_score}/100</span>
            </div>
            <p style={{ fontSize: 14 }}>{run.synthesis.reasoning_summary}</p>
            <dl className="v-kv" style={{ marginTop: 10 }}>
              <dt>Mapped severity</dt><dd className="v-mono">{run.synthesis.mapped.severity} · {run.synthesis.mapped.reasonCode}</dd>
              <dt>Confidence</dt><dd>{run.synthesis.mapped.confidence}% · valid {run.synthesis.mapped.validityDays}d</dd>
              <dt>Engines</dt>
              <dd className="v-mono">
                {(Object.entries(run.engines ?? {}) as [string, { provider: string; model: string }][]).map(([call, engine]) => `${call}:${engine.provider}`).join(' · ') || run.model}
              </dd>
              <dt>Tokens</dt>
              <dd className="v-mono">
                {(run.usage ?? []).reduce((sum, u) => sum + (u.inputTokens ?? 0), 0).toLocaleString()} in ·{' '}
                {(run.usage ?? []).reduce((sum, u) => sum + (u.outputTokens ?? 0), 0).toLocaleString()} out
              </dd>
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
