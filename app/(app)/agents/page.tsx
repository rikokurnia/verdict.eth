'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import AgentQuartet from '@/components/app/agent-quartet';
import StatusChip from '@/components/app/status-chip';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import type { VerdictApiResponse } from '@/lib/verdict-types';

const STEPS = ['Agent', 'ENS Name', 'Resolver', 'Issuer + Auditor + Risk Records', 'Deterministic Policy', 'POLICY_PASS / REVIEW / BLOCKED / UNAVAILABLE'];
const NAME_PATTERN = /^(?=.{1,255}$)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/;
const DEFAULT_NAME = ENSV2_SEPOLIA.names.asset;

type AgentApi = {
  ok: boolean;
  chainId: number;
  agent: {
    name: string;
    resolver: string;
    schema: string;
    context: string;
    endpoints: { mcp: string; default: string };
    bound: { context: boolean; mcp: boolean };
    registryBinding: string;
  };
  loop: {
    available: boolean;
    mode?: string;
    chainId?: number;
    subject?: string;
    evidenceFile?: string;
    model?: string;
    decision?: { auditStatus?: string; severity?: string; reasonCode?: string; confidence?: number; validityDays?: number; rationale?: string };
    sourceHash?: string;
    transactions?: { audit?: { hash?: string; blockNumber?: number }; risk?: { hash?: string; blockNumber?: number } };
    recordedAt?: string;
  };
  explorer: string;
};

type AskState = 'idle' | 'running' | 'done' | 'error';

function shortHash(value: string | undefined) {
  return value && value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value || '—';
}

function formatDateTime(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function AgentsPage() {
  const [agentApi, setAgentApi] = useState<AgentApi | null>(null);
  const [agentError, setAgentError] = useState(false);
  const [query, setQuery] = useState<string>(DEFAULT_NAME);
  const [askState, setAskState] = useState<AskState>('idle');
  const [result, setResult] = useState<VerdictApiResponse | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const loadAgent = useCallback(async () => {
    try {
      const response = await fetch('/api/agent', { cache: 'no-store' });
      if (!response.ok) throw new Error('agent api unavailable');
      setAgentApi((await response.json()) as AgentApi);
      setAgentError(false);
    } catch {
      setAgentError(true);
    }
  }, []);

  useEffect(() => {
    void loadAgent();
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [loadAgent]);

  async function ask(name: string) {
    const target = name.trim().toLowerCase();
    if (!NAME_PATTERN.test(target)) {
      setAskError('Enter a valid lowercase .eth name.');
      return;
    }
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAskState('running');
    setAskError(null);
    setResult(null);
    setRevealed(0);
    setElapsedMs(null);
    const started = performance.now();
    try {
      const response = await fetch(`/api/verdict?name=${encodeURIComponent(target)}`, { cache: 'no-store' });
      const body = (await response.json()) as VerdictApiResponse;
      setElapsedMs(Math.round(performance.now() - started));
      setResult(body);
      setAskState(response.ok && body.ok ? 'done' : 'error');
      if (!response.ok || !body.ok) setAskError(`${body.reason ?? 'Resolver unavailable.'} No decision is inferred.`);
      // Reveal each verified step in sequence — every check reflects a
      // validated field of the live response, never a canned animation.
      for (let i = 1; i <= 6; i += 1) {
        const timer = setTimeout(() => setRevealed(i), i * 280);
        timers.current.push(timer);
      }
    } catch {
      setElapsedMs(Math.round(performance.now() - started));
      setAskState('error');
      setAskError('Network or resolver failure. No decision is inferred.');
    }
  }

  const ai = result?.audit?.ai;
  const loop = agentApi?.loop;
  const explorer = agentApi?.explorer ?? ENSV2_SEPOLIA.explorer;
  const verdictDays = result?.evidence.daysRemaining;
  const nextDue = result?.audit
    ? verdictDays !== undefined && verdictDays < 0
      ? `Overdue by ${Math.abs(verdictDays)}d — re-attestation required`
      : `Re-attestation due in ${verdictDays}d (${result.audit.expiresAt ? new Date(result.audit.expiresAt * 1000).toLocaleDateString() : 'unknown'})`
    : 'Resolve an asset above to compute the next due action.';

  const steps: { label: string; detail: string; ok: boolean }[] = result ? [
    { label: 'Resolve identity', detail: `Universal ${shortHash(result.infrastructure.universalResolver)} → resolver ${shortHash(result.sources[0]?.resolver)}`, ok: result.sources.length > 0 },
    { label: 'Read issuer branch', detail: result.asset ? `${result.asset.displayName} · ${result.asset.ticker} · ${result.asset.issuer}` : 'Issuer records missing', ok: Boolean(result.asset) },
    { label: 'Read auditor authority', detail: result.audit ? `${result.audit.name} · ${result.audit.status}` : 'Auditor records missing', ok: Boolean(result.audit) },
    { label: 'Read risk authority', detail: result.observation ? `${result.observation.name} · ${result.observation.severity} · ${result.observation.reasonCode}` : 'Risk records missing', ok: Boolean(result.observation) },
    {
      label: 'Evaluate policy',
      detail: `expiry ${result.evidence.daysRemaining}d · heartbeat ${result.evidence.fresh ? 'fresh' : 'stale'} · revoked ${String(result.evidence.revoked)} · conflict ${String(result.evidence.riskConflict)}`,
      ok: result.ok,
    },
    { label: 'Verdict', detail: `${result.state} · block ${result.sourceBlock ?? '—'}${elapsedMs !== null ? ` · resolved in ${elapsedMs}ms` : ''}`, ok: result.ok },
  ] : [];

  return (
    <>
      <PageHead title="Agents" sub="Ask the evidence graph a question. Every check below is earned from live ENSv2 state." />

      <div className="v-card v-glass-card v-fullwidth-card">
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">01 / ASK VERDICT</div>
            <h3 className="v-section-title">Suitable for allocation?</h3>
            <p className="v-muted">Type any .eth name. The console resolves it through the hackathon Universal Resolver, reads the independent authorities, and evaluates the deterministic policy — live.</p>
          </div>
        </div>
        <form
          className="v-table-toolbar"
          onSubmit={(event) => { event.preventDefault(); void ask(query); }}
        >
          <div className="v-table-search-box" style={{ flex: 1 }}>
            <Search size={15} className="v-search-icon" aria-hidden="true" />
            <label className="v-visually-hidden" htmlFor="ask-verdict-input">Asset ENS name</label>
            <input
              id="ask-verdict-input"
              className="v-search-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={DEFAULT_NAME}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={askState === 'running'}
            />
          </div>
          <button type="submit" className="v-btn" disabled={askState === 'running'} aria-busy={askState === 'running'}>
            {askState === 'running' ? 'Resolving…' : 'Ask Verdict'}
          </button>
          <button type="button" className="v-btn v-btn-secondary" disabled={askState === 'running'} onClick={() => void ask(DEFAULT_NAME)}>
            Demo asset
          </button>
        </form>

        {(askState === 'running' || result) && (
          <div className="v-cli" style={{ marginTop: 12 }} role="status" aria-live="polite">
            <div><span className="v-dim">$</span> suitable {result?.name ?? query.trim().toLowerCase()}</div>
            {askState === 'running' && !result && <div className="v-dim">Resolving identity…</div>}
            {steps.slice(0, revealed).map((step) => (
              <div key={step.label}>
                {step.label}… {step.ok ? <span className="v-pass-t">✓</span> : <span className="v-block-t">×</span>}{' '}
                <span className="v-dim">{step.detail}</span>
              </div>
            ))}
            {result && revealed >= 6 && (
              <>
                <div><span className={result.ok ? 'v-pass-t' : 'v-block-t'}>{result.state}</span></div>
                <div className="v-dim">{result.reason}</div>
              </>
            )}
            {askState === 'error' && askError && <div className="v-block-t">{askError}</div>}
          </div>
        )}
        {askError && askState !== 'error' && <p className="v-muted" role="alert">{askError}</p>}
      </div>

      <AgentQuartet />

      <div className="v-split" style={{ marginTop: 16 }}>
        <div className="v-card">
          <div className="v-label">Agent loop status · {loop?.available ? 'last recorded run' : 'operator cron'}</div>
          {agentError && <p className="v-muted">Agent API unreachable. Onchain evidence above remains the source of truth.</p>}
          {!agentError && !agentApi && <p className="v-muted">Loading loop status…</p>}
          {agentApi && (
            <dl className="v-kv">
              <dt>Caller</dt><dd>Operator terminal cron · <span className="v-mono">audit:ai --write</span></dd>
              <dt>Mode</dt><dd>{loop?.available ? loop.mode : 'No local run recorded'}</dd>
              <dt>Model</dt><dd>{loop?.model ?? ai?.model ?? '—'}</dd>
              <dt>Reason</dt><dd className="v-mono">{loop?.decision?.reasonCode ?? result?.observation?.reasonCode ?? '—'}</dd>
              <dt>Confidence</dt><dd>{loop?.decision?.confidence ?? ai?.confidence ?? '—'}{loop?.decision?.confidence !== undefined || ai?.confidence !== undefined ? '%' : ''}</dd>
              <dt>Evidence</dt><dd className="v-mono" title={loop?.sourceHash}>{shortHash(loop?.sourceHash ?? ai?.sourceHash)} · {loop?.evidenceFile ?? 'onchain only'}</dd>
              <dt>Recorded</dt><dd>{formatDateTime(loop?.recordedAt)}</dd>
              <dt>Next due</dt><dd>{nextDue}</dd>
            </dl>
          )}
          {loop?.available && loop.transactions?.audit?.hash && (
            <div className="v-mono" style={{ fontSize: 12, marginTop: 8 }}>
              <a href={`${explorer}/tx/${loop.transactions.audit.hash}`} target="_blank" rel="noreferrer">Auditor write ↗</a>
              {loop.transactions.risk?.hash && <>{' · '}<a href={`${explorer}/tx/${loop.transactions.risk.hash}`} target="_blank" rel="noreferrer">Monitor write ↗</a></>}
            </div>
          )}
        </div>
        <div className="v-card">
          <div className="v-label">Agent identity · ENSIP-26 live</div>
          {!agentApi && !agentError && <p className="v-muted">Resolving agent records…</p>}
          {agentApi && (
            <dl className="v-kv">
              <dt>Name</dt><dd className="v-mono">{agentApi.agent.name}</dd>
              <dt>Schema</dt><dd className="v-mono">{agentApi.agent.schema || '—'}</dd>
              <dt>Context</dt><dd>{agentApi.agent.bound.context ? `Bound ✓ · “${agentApi.agent.context}”` : 'Unbound — no agent-context record'}</dd>
              <dt>Endpoint</dt><dd>{agentApi.agent.bound.mcp ? `Bound ✓ · ${agentApi.agent.endpoints.mcp}` : 'Unbound — agent-endpoint[mcp] not set; discovery only, no machine interface yet'}</dd>
              <dt>Registry</dt><dd>ENSIP-25 binding not claimed — operator attestation only</dd>
              <dt>Resolver</dt><dd className="v-mono"><a href={`${explorer}/address/${agentApi.agent.resolver}`} target="_blank" rel="noreferrer">{shortHash(agentApi.agent.resolver)} ↗</a></dd>
            </dl>
          )}
          <div style={{ marginTop: 10 }}>
            <a className="v-btn-detail" href={`${explorer}/address/${agentApi?.agent.resolver ?? ENSV2_SEPOLIA.proxies.namespaceResolver}`} target="_blank" rel="noreferrer">
              Inspect resolver<ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Last autonomous rationale</div>
        <p style={{ margin: '10px 0' }}>{loop?.decision?.rationale ?? ai?.rationale ?? 'Resolve an asset or wait for the auditor loop — no rationale is available.'}</p>
        <button type="button" className="v-btn v-btn-secondary" onClick={() => { void loadAgent(); }}>
          <RefreshCw size={14} aria-hidden="true" />Refresh loop status
        </button>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Resolution flow</div>
        <div className="v-flow" role="img" aria-label="Agent resolves ENS name through resolver to records to policy to verdict">
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: 'contents' }}>
              <span className="v-step"><strong>{String(i + 1).padStart(2, '0')}</strong>{s}</span>
              {i < STEPS.length - 1 && <span className="v-step-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>The agent and web UI read the same ENSv2 evidence graph and deterministic policy. The API signs nothing and holds no custody key.</p>
    </>
  );
}
