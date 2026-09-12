"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { PageHead } from "@/components/app/app-shell";
import AgentFactory from "@/components/app/agent-factory";
import AgentQuartet from "@/components/app/agent-quartet";
import { ENSV2_SEPOLIA, ENS_RESOLVER_URL } from "@/lib/ensv2-config";

const STEPS = [
  "Agent",
  "ENS Name",
  "Resolver",
  "Issuer + Auditor + Risk Records",
  "Deterministic Policy",
  "POLICY_PASS / REVIEW / BLOCKED / UNAVAILABLE",
];

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
    decision?: {
      auditStatus?: string;
      severity?: string;
      reasonCode?: string;
      confidence?: number;
      validityDays?: number;
      rationale?: string;
    };
    sourceHash?: string;
    transactions?: {
      audit?: { hash?: string; blockNumber?: number };
      risk?: { hash?: string; blockNumber?: number };
    };
    recordedAt?: string;
  };
  explorer: string;
};

function shortHash(value: string | undefined) {
  return value && value.length > 18
    ? `${value.slice(0, 10)}…${value.slice(-6)}`
    : value || "—";
}

function formatDateTime(value: string | undefined) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AgentsPage() {
  const [agentApi, setAgentApi] = useState<AgentApi | null>(null);
  const [agentError, setAgentError] = useState(false);
  const loadAgent = useCallback(async () => {
    try {
      const response = await fetch("/api/agent", { cache: "no-store" });
      if (!response.ok) throw new Error("agent api unavailable");
      setAgentApi((await response.json()) as AgentApi);
      setAgentError(false);
    } catch {
      setAgentError(true);
    }
  }, []);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  const loop = agentApi?.loop;
  const explorer = agentApi?.explorer ?? ENSV2_SEPOLIA.explorer;
  return (
    <>
      <PageHead
        title="Agents"
        sub="Commission your auditor. Watch independent agents turn evidence into a decision."
      />

      <AgentFactory
        onMinted={(subname) => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("verdict:auditor-minted", { detail: subname }),
            );
          }
        }}
      />
      <AgentQuartet />

      <div className="v-split" style={{ marginTop: 16 }}>
        <div className="v-card">
          <div className="v-label">
            Agent loop status ·{" "}
            {loop?.available ? "last recorded run" : "operator cron"}
          </div>
          {agentError && (
            <p className="v-muted">
              Agent API unreachable. Onchain evidence above remains the source
              of truth.
            </p>
          )}
          {!agentError && !agentApi && (
            <p className="v-muted">Loading loop status…</p>
          )}
          {agentApi && (
            <dl className="v-kv">
              <dt>Caller</dt>
              <dd>
                Operator terminal cron ·{" "}
                <span className="v-mono">audit:ai --write</span>
              </dd>
              <dt>Mode</dt>
              <dd>{loop?.available ? loop.mode : "No local run recorded"}</dd>
              <dt>Reason</dt>
              <dd className="v-mono">{loop?.decision?.reasonCode ?? "—"}</dd>
              <dt>Confidence</dt>
              <dd>
                {loop?.decision?.confidence ?? "—"}
                {loop?.decision?.confidence !== undefined ? "%" : ""}
              </dd>
              <dt>Evidence</dt>
              <dd className="v-mono" title={loop?.sourceHash}>
                {shortHash(loop?.sourceHash)} ·{" "}
                {loop?.evidenceFile ?? "onchain only"}
              </dd>
              <dt>Recorded</dt>
              <dd>{formatDateTime(loop?.recordedAt)}</dd>
            </dl>
          )}
          {loop?.available && loop.transactions?.audit?.hash && (
            <div className="v-mono" style={{ fontSize: 12, marginTop: 8 }}>
              <a
                href={`${explorer}/tx/${loop.transactions.audit.hash}`}
                target="_blank"
                rel="noreferrer"
                title={`Onchain log · ${loop.transactions.audit.hash}`}
              >
                Auditor write ↗
              </a>
              {loop.transactions.risk?.hash && (
                <>
                  {" · "}
                  <a
                    href={`${explorer}/tx/${loop.transactions.risk.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Onchain log · ${loop.transactions.risk.hash}`}
                  >
                    Monitor write ↗
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <div className="v-card">
          <div className="v-label">Agent identity · ENSIP-26 live</div>
          {!agentApi && !agentError && (
            <p className="v-muted">Resolving agent records…</p>
          )}
          {agentApi && (
            <dl className="v-kv">
              <dt>Name</dt>
              <dd className="v-mono">{agentApi.agent.name}</dd>
              <dt>Schema</dt>
              <dd className="v-mono">{agentApi.agent.schema || "—"}</dd>
              <dt>Context</dt>
              <dd>
                {agentApi.agent.bound.context
                  ? `Bound ✓ · “${agentApi.agent.context}”`
                  : "Unbound — no agent-context record"}
              </dd>
              <dt>Endpoint</dt>
              <dd>
                {agentApi.agent.bound.mcp
                  ? `Bound ✓ · ${agentApi.agent.endpoints.mcp}`
                  : "Unbound — agent-endpoint[mcp] not set; discovery only, no machine interface yet"}
              </dd>
              <dt>Registry</dt>
              <dd>ENSIP-25 binding not claimed — operator attestation only</dd>
              <dt>Resolver</dt>
              <dd className="v-mono">
                <a
                  href={ENS_RESOLVER_URL(agentApi.agent.resolver)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHash(agentApi.agent.resolver)} ↗
                </a>
              </dd>
            </dl>
          )}
          <div style={{ marginTop: 10 }}>
            <a
              className="v-btn-detail"
              href={ENS_RESOLVER_URL(agentApi?.agent.resolver ?? ENSV2_SEPOLIA.proxies.namespaceResolver)}
              target="_blank"
              rel="noreferrer"
            >
              Inspect resolver
              <ArrowUpRight size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Last autonomous rationale</div>
        <p style={{ margin: "10px 0" }}>
          {loop?.decision?.rationale ?? "No autonomous rationale recorded yet."}
        </p>
        <button
          type="button"
          className="v-btn v-btn-secondary"
          onClick={() => {
            void loadAgent();
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Refresh loop status
        </button>
      </div>

      <div className="v-card" style={{ marginTop: 16 }}>
        <div className="v-label">Resolution flow</div>
        <div
          className="v-flow"
          role="img"
          aria-label="Agent resolves ENS name through resolver to records to policy to verdict"
        >
          {STEPS.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span className="v-step">
                <strong>{String(i + 1).padStart(2, "0")}</strong>
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="v-step-arrow">→</span>}
            </span>
          ))}
        </div>
      </div>
      <p className="v-muted" style={{ marginTop: 16 }}>
        The agent and web UI read the same ENSv2 evidence graph and
        deterministic policy. The API signs nothing and holds no custody key.
      </p>
    </>
  );
}
