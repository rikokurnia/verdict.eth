"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import {
  Play,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
  Radio,
  RotateCcw,
} from "lucide-react";
import AgentTerminalCard, {
  type AgentFlowNode,
  type AgentId,
  type AgentVisualState,
} from "@/components/ui/agent-terminal-card";
import { ENSV2_SEPOLIA as ENS } from "@/lib/ensv2-config";
import { DEMO_ASSETS } from "./demo-data";
import type { QuartetRun } from "@/lib/agents/types";
import s from "./agent-orchestra.module.css";

const ids: AgentId[] = ["legal", "custody", "technical", "consensus"];
const definitions = {
  legal: {
    name: "Legal & Compliance",
    ensName: ENS.names.audit,
    address: ENS.proxies.auditorResolver,
    avatarUrl: "/assets/agent-assets/satelit1.png",
    labels: [
      "Resolve authority & registry",
      "Assess ownership & compliance",
      "Return legal findings",
    ],
  },
  custody: {
    name: "Custody & Backing",
    ensName: "Auditor resolver ↗",
    address: ENS.proxies.auditorResolver,
    avatarUrl: "/assets/agent-assets/plane2.png",
    labels: [
      "Receive shared evidence",
      "Assess reserves & collateral",
      "Return custody findings",
    ],
  },
  technical: {
    name: "Smart Contract Tech",
    ensName: ENS.names.agent,
    address: ENS.proxies.namespaceResolver,
    avatarUrl: "/assets/agent-assets/drone.png",
    labels: [
      "Receive contract evidence",
      "Assess bytecode & access roles",
      "Return technical findings",
    ],
  },
  consensus: {
    name: "Consensus Synthesizer",
    ensName: "Verdict registry ↗",
    address: ENS.proxies.verdictRegistry,
    avatarUrl: "/assets/agent-assets/satelit2.png",
    labels: [
      "Ingest three inspector reports",
      "Compute weighted risk matrix",
      "Finalize inspect-only verdict",
    ],
  },
};
const options = [
  { value: ENS.names.asset, label: "USDY-001 · USD Yield 001" },
  ...DEMO_ASSETS.filter((a) => a.marketId).map((a) => ({
    value: a.marketId!,
    label: `${a.ticker} · ${a.title}`,
  })),
];
type Frame = {
  kind: string;
  label?: string;
  detail?: string;
  t?: string;
  run?: QuartetRun;
};
type Entry = { file: string; recordedAt: string; run: QuartetRun };
const idle = (): Record<AgentId, AgentVisualState> => ({
  legal: "idle",
  custody: "idle",
  technical: "idle",
  consensus: "idle",
});
const time = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour12: false });
import {
  StatusBadge,
  getUnifiedVerdict,
  type UnifiedVerdict,
} from '@/components/app/status-badge';
export { StatusBadge, getUnifiedVerdict, type UnifiedVerdict };

const resultState = (value: string): AgentVisualState =>
  getUnifiedVerdict(value) === "VERIFIED" ? "completed" : "flagged";

function DataEdge(props: EdgeProps) {
  const [curve] = getBezierPath(props);
  const lane = props.sourceX - 185 - Number(props.data?.lane ?? 0) * 9;
  const path = props.data?.narrow
    ? `M${props.sourceX},${props.sourceY} Q${props.sourceX},${props.sourceY + 15} ${lane},${props.sourceY + 15} L${lane},${props.targetY - 20} Q${lane},${props.targetY - 8} ${props.targetX},${props.targetY - 8} L${props.targetX},${props.targetY}`
    : curve;
  const state = String(props.data?.state ?? "idle");
  return (
    <g className={`${s.edge} ${s[`edge_${state}`]}`}>
      <path d={path} className={s.edgeTrack} />
      <path d={path} pathLength={1} className={s.edgeSignal} />
      {state === "running" && (
        <path d={path} pathLength={1} className={s.edgePacket} />
      )}
    </g>
  );
}
const nodeTypes = { agentTerminal: AgentTerminalCard };
const edgeTypes = { telemetry: DataEdge };

function RunDetails({ run }: { run: QuartetRun }) {
  return (
    <div className={s.runDetails}>
      <div className={s.summary}>
        <div>
          <span className={s.kicker}>Consensus synthesis</span>
          <h3 className={s.synthesisBadgeWrap}>
            <StatusBadge status={run.synthesis.policy_state} size="lg" />
          </h3>
          <p>{run.synthesis.reasoning_summary}</p>
        </div>
        <div className={s.bigScore}>
          {run.synthesis.overall_score}
          <small>/100 · composite score</small>
        </div>
      </div>
      <div className={s.findings}>
        {ids.map((id) => (
          <section key={id}>
            <h4>{definitions[id].name}</h4>
            {id === "consensus" ? (
              <>
                <div className={s.inspectorScoreRow}>
                  <StatusBadge status={run.synthesis.verdict} size="sm" />
                  <span className={s.inspectorScoreText}>
                    · {run.synthesis.mapped.confidence}% confidence ·{" "}
                    {run.synthesis.mapped.validityDays}d validity
                  </span>
                </div>
                <p>{run.synthesis.mapped.rationale}</p>
              </>
            ) : (
              <>
                <div className={s.inspectorScoreRow}>
                  <StatusBadge status={run.reports[id].status} size="sm" />
                  <span className={s.inspectorScoreText}>
                    · {run.reports[id].score}/100
                  </span>
                </div>
                <ul>
                  {run.reports[id].findings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
                <div className={s.proofLinks}>
                  {run.reports[id].evidence_urls
                    .filter((u) => /^https?:\/\//i.test(u))
                    .map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        Source {i + 1}
                        <ArrowUpRight size={13} />
                      </a>
                    ))}
                </div>
              </>
            )}
          </section>
        ))}
      </div>
      <div className={s.proofLinks}>
        <ShieldCheck size={16} />
        <span>
          {run.write.performed
            ? "Onchain write recorded"
            : "Inspect-only · no transaction emitted"}
        </span>
        {Object.entries(run.write.transactions ?? {}).map(([name, tx]) => (
          <a
            key={name}
            href={`${ENS.explorer}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {name} transaction ↗
          </a>
        ))}
        <a
          href={`${ENS.explorer}/address/${ENS.proxies.verdictRegistry}`}
          target="_blank"
          rel="noreferrer"
        >
          ENS registry ↗
        </a>
      </div>
      <details className={s.records}>
        <summary>
          {run.write.performed
            ? "ENS record output"
            : "Proposed ENS records · not published"}
        </summary>
        <dl>
          {Object.entries(run.synthesis.ensv2_records).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

export default function AgentQuartet() {
  const [subject, setSubject] = useState<string>(options[0].value);
  const [mode, setMode] = useState("official");
  const [custom, setCustom] = useState("");
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState(idle);
  const [completed, setCompleted] = useState<Partial<Record<AgentId, string>>>(
    {},
  );
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<Frame | null>(null);
  const [narrow, setNarrow] = useState(false);
  const source = useRef<EventSource | null>(null);
  const reduce = useReducedMotion();
  const loadHistory = useCallback(async () => {
    setHistoryStatus("loading");
    try {
      const response = await fetch("/api/agents/runs", { cache: "no-store" });
      if (!response.ok) throw Error();
      const body = await response.json();
      setHistory((prev) =>
        [
          ...prev.filter(
            (e) => !body.runs.some((n: Entry) => n.run.id === e.run.id),
          ),
          ...body.runs,
        ].sort(
          (a, b) => Date.parse(b.run.finishedAt) - Date.parse(a.run.finishedAt),
        ),
      );
      setHistoryStatus("ready");
    } catch {
      setHistoryStatus("error");
    }
  }, []);
  useEffect(() => {
    void loadHistory();
    const media = matchMedia("(max-width: 850px)");
    const resize = () => setNarrow(media.matches);
    resize();
    media.addEventListener("change", resize);
    try {
      setCustom(localStorage.getItem("verdict-custom-agent") ?? "");
    } catch {}
    const minted = (e: Event) => {
      setCustom((e as CustomEvent<string>).detail);
      setMode("custom");
    };
    window.addEventListener("verdict:auditor-minted", minted);
    return () => {
      media.removeEventListener("change", resize);
      window.removeEventListener("verdict:auditor-minted", minted);
      source.current?.close();
    };
  }, [loadHistory]);
  const nodes = useMemo<AgentFlowNode[]>(
    () =>
      ids.map((id, i) => ({
        id,
        type: "agentTerminal",
        position: narrow
          ? { x: 20, y: i * 390 + 30 }
          : {
              x: id === "consensus" ? 405 : 25 + i * 380,
              y: id === "consensus" ? 435 : 35,
            },
        data: {
          ...definitions[id],
          agentId: id,
          eyebrow: i === 3 ? "04 / SYNTHESIS CORE" : `0${i + 1} / INSPECTOR`,
          state: states[id],
          score: run
            ? id === "consensus"
              ? run.synthesis.overall_score
              : run.reports[id].score
            : undefined,
          steps: definitions[id].labels.map((label, step) => ({
            label,
            status:
              states[id] === "running"
                ? step === 1
                  ? "running"
                  : step === 0
                    ? "completed"
                    : "idle"
                : states[id] === "flagged"
                  ? step === 0
                    ? "completed"
                    : "flagged"
                  : states[id],
            time: completed[id] ? time(completed[id]!) : undefined,
          })),
        },
      })),
    [states, completed, run, narrow],
  );
  const edges = ids
    .slice(0, 3)
    .map((id, index) => ({
      id,
      source: id,
      target: "consensus",
      type: "telemetry",
      data: { state: states[id], narrow, lane: index },
    }));
  function start() {
    if (running) return;
    if (
      mode === "custom" &&
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/.test(custom.trim())
    ) {
      setError("Enter a valid custom auditor ENS name.");
      return;
    }
    setError("");
    setRun(null);
    setStates(idle());
    setCompleted({});
    setRunning(true);
    setLastFrame({
      kind: "preparing",
      label: "Collecting evidence for the inspector fleet",
    });
    const params = new URLSearchParams({ subject, mode });
    if (mode === "custom") params.set("agentSubname", custom.trim());
    source.current?.close();
    const stream = new EventSource(`/api/agents/stream?${params}`);
    source.current = stream;
    const fail = (message: string) => {
      stream.close();
      setRunning(false);
      setError(message);
      setStates(
        (prev) =>
          Object.fromEntries(
            ids.map((id) => [id, prev[id] === "running" ? "error" : prev[id]]),
          ) as Record<AgentId, AgentVisualState>,
      );
    };
    stream.onmessage = (event) => {
      if (source.current !== stream) return;
      try {
        const frame: Frame = JSON.parse(event.data);
        setLastFrame(frame);
        if (frame.kind === "error") {
          fail(
            "Inspection could not finish. Please retry; if it persists, check the service connection.",
          );
          return;
        }
        const id = ids.find((id) => frame.label?.includes(id));
        if (frame.kind === "inspector-start" && id)
          setStates((prev) => ({ ...prev, [id]: "running" }));
        if (frame.kind === "inspector-ok" && id) {
          setStates((prev) => ({
            ...prev,
            [id]: resultState(frame.detail?.split(" ")[0] ?? "WARN"),
          }));
          setCompleted((prev) => ({ ...prev, [id]: frame.t }));
        }
        if (frame.kind === "synthesis-start")
          setStates((prev) => ({ ...prev, consensus: "running" }));
        if (frame.kind === "synthesis-ok") {
          setStates((prev) => ({
            ...prev,
            consensus: frame.label?.includes("PASS") ? "completed" : "flagged",
          }));
          setCompleted((prev) => ({ ...prev, consensus: frame.t }));
        }
        if (frame.kind === "result" && frame.run) {
          const result = frame.run;
          setLastFrame({
            kind: "done",
            label: `Inspection complete · ${getUnifiedVerdict(result.synthesis.policy_state)}`,
            t: result.finishedAt,
          });
          stream.close();
          setRunning(false);
          setRun(result);
          setCompleted((previous) => Object.fromEntries(ids.map((id) => [id, previous[id] ?? result.finishedAt])));
          setStates({
            legal: resultState(result.reports.legal.status),
            custody: resultState(result.reports.custody.status),
            technical: resultState(result.reports.technical.status),
            consensus: resultState(result.synthesis.verdict),
          });
          setHistory((prev) => [
            { file: result.id, recordedAt: result.finishedAt, run: result },
            ...prev.filter((e) => e.run.id !== result.id),
          ]);
          setExpanded(result.id);
        }
      } catch {
        fail("Unreadable telemetry. Retry the inspection.");
      }
    };
    stream.onerror = () =>
      fail(
        "Connection interrupted. Retry the inspection when connectivity returns.",
      );
  }
  return (
    <section className={s.inspectionSection} aria-labelledby="inspection-title">
      <div className={s.sectionHeading}>
        <div>
          <span className={s.kicker}>03 / 4-AGENT INSPECTION</span>
          <h2 id="inspection-title">
            Independent minds.
            <br />
            <em>One clear verdict.</em>
          </h2>
          <p>
            Legal, custody, and code. Three parallel investigations converge
            into a single evidence-backed decision.
          </p>
        </div>
        <div className={s.headingStamp}>
          <Radio size={19} />
          <span>
            INSPECTION NETWORK<strong>3 inspectors + 1 synthesizer</strong>
          </span>
        </div>
      </div>
      <div className={s.controlDeck}>
        <div className={s.modeSwitch} role="group" aria-label="Inspection mode">
          {["official", "custom"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              disabled={running}
            >
              {value === "official" ? "Official quartet" : "Custom lens"}
            </button>
          ))}
        </div>
        <label className={s.targetSelect}>
          <span>Inspection target</span>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={running}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button className={s.runButton} onClick={start} disabled={running}>
          {run ? (
            <RotateCcw size={16} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          {running ? "Inspecting…" : "Run inspection"}
        </button>
      </div>
      {mode === "custom" && (
        <label className={s.customLens}>
          Auditor ENS identity
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.toLowerCase())}
            placeholder="zero-risk.verdict.eth"
            disabled={running}
            autoComplete="off"
          />
        </label>
      )}
      <div className={`${s.flowShell} ${narrow ? s.flowNarrow : ""}`}>
        <div className={s.flowLegend}>
          <span>
            <i />
            {running ? "LIVE TELEMETRY" : run ? "INSPECTION COMPLETE" : "FLEET STANDBY"}
          </span>
          <span>LEGAL 30% / CUSTODY 40% / TECH 30%</span>
        </div>
        {!reduce && (
          <ParticlesProvider init={loadSlim}>
            <Particles
              className={s.particles}
              id="fleet-stars"
              options={{
                fullScreen: { enable: false },
                fpsLimit: 24,
                particles: {
                  number: { value: 38 },
                  color: { value: "#a3d1ff" },
                  size: { value: { min: 0.5, max: 1.5 } },
                  opacity: { value: 0.25 },
                  move: { enable: true, speed: 0.12 },
                },
              }}
            />
          </ParticlesProvider>
        )}
        <ReactFlow
          key={narrow ? "mobile" : "desktop"}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.03 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          preventScrolling={false}
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={28} size={1} color="#284058" />
        </ReactFlow>
        <div className={s.canvasFooter}>
          <ShieldCheck size={14} />
          Inspect-only session<span>No chain write requested</span>
        </div>
      </div>
      <div className={s.telemetryStrip} role="status">
        <span className={s.kicker}>MISSION LOG</span>
        <span>
          {lastFrame?.label ??
            "Fleet ready. Select an asset to begin inspection."}
        </span>
        {lastFrame?.t && <time>{time(lastFrame.t)}</time>}
      </div>
      {error && (
        <div className={s.errorBanner} role="alert">
          <span>{error}</span>
          <button onClick={start}>Retry inspection</button>
        </div>
      )}
      <div className={s.historySection}>
        <div className={s.historyHeader}>
          <div>
            <span className={s.kicker}>VERIFIABLE OUTPUT</span>
            <h3>
              Run history
              <span>{history.length.toString().padStart(2, "0")}</span>
            </h3>
          </div>
          <button onClick={loadHistory} aria-label="Refresh run history">
            <RotateCcw size={16} />
          </button>
        </div>
        {historyStatus === "loading" && !history.length ? (
          <div className={s.emptyHistory}>Loading recorded inspections…</div>
        ) : historyStatus === "error" ? (
          <div className={s.errorBanner}>
            History could not load.<button onClick={loadHistory}>Retry</button>
          </div>
        ) : !history.length ? (
          <div className={s.emptyHistory}>
            <ShieldCheck size={28} />
            <strong>Your first verdict starts here.</strong>
            <span>Run an inspection to build your decision archive.</span>
          </div>
        ) : (
          history.slice(0, 20).map((entry) => (
            <motion.article
              key={entry.run.id}
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={s.historyItem}
            >
              <button
                className={s.historyTrigger}
                aria-expanded={expanded === entry.run.id}
                onClick={() =>
                  setExpanded(expanded === entry.run.id ? null : entry.run.id)
                }
              >
                <StatusBadge status={entry.run.synthesis.verdict} size="md" />
                <span className={s.historySubject}>
                  <strong>{entry.run.subject}</strong>
                  <small>
                    {entry.run.mode === "custom"
                      ? entry.run.customPolicy?.subname
                      : "Official quartet"}{" "}
                    · {Math.round(entry.run.durationMs / 1000)}s
                  </small>
                </span>
                <span className={s.historyScore}>
                  {entry.run.synthesis.overall_score}
                  <small>/100</small>
                </span>
                <time>{new Date(entry.recordedAt).toLocaleString()}</time>
                <ChevronDown
                  size={16}
                  style={{
                    transform:
                      expanded === entry.run.id ? "rotate(180deg)" : undefined,
                  }}
                />
              </button>
              <AnimatePresence initial={false}>
                {expanded === entry.run.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.22 }}
                    style={{ overflow: "hidden" }}
                  >
                    <RunDetails run={entry.run} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          ))
        )}
      </div>
    </section>
  );
}
