"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  getBezierPath,
  getNodesBounds,
  useNodes,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useReducedMotion } from "motion/react";
import Particles, { ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import {
  Play,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  RotateCcw,
} from "lucide-react";
import AgentTerminalCard, {
  type AgentCognitiveData,
  type AgentFlowNode,
  type AgentId,
  type AgentVisualState,
} from "@/components/ui/agent-terminal-card";
import { ENSV2_SEPOLIA as ENS } from "@/lib/ensv2-config";
import { DEMO_ASSETS } from "./demo-data";
import type { QuartetRun, InspectorReport, Synthesis } from "@/lib/agents/types";
import {
  SESSION_RUN_EVENT,
  loadSessionRuns,
  saveSessionRun,
} from "@/lib/session-runs";
import s from "./agent-orchestra.module.css";
import { CUSTOM_AGENT_EVENT, CUSTOM_AGENTS_KEY, LEGACY_CUSTOM_AGENT_KEY, loadCustomAgents, validCustomAgentName } from '@/lib/custom-agent-store';
import { CustomAgentPicker, type VerifiedCustomAgent } from './custom-agent-picker';

const NODE_WIDTH = 340;
const NODE_HEIGHT = 580;
const COL_STEP = 364;
const ids = ["legal", "custody", "technical", "consensus"] as const;
const definitions = {
  legal: {
    name: "Legal & Compliance",
    ensName: ENS.names.agents.legal,
    address: ENS.proxies.auditorResolver,
    avatarUrl: "/assets/agent-assets/satelit1.png",
    scope: "SPV corporate structure, regulatory jurisdiction, offering exemption & investor eligibility whitelist.",
    runningTelemetry: "Resolving authority nodes & verifying issuer legal disclosures...",
    labels: [
      "Resolve authority & registry",
      "Assess ownership & compliance",
      "Return legal findings",
    ],
  },
  custody: {
    name: "Custody & Backing",
    ensName: ENS.names.agents.custody,
    address: ENS.proxies.monitorResolver,
    avatarUrl: "/assets/agent-assets/plane2.png",
    scope: "Independent custodian verification, bankruptcy-remoteness & reserve collateralization match.",
    runningTelemetry: "Checking custodian omnibus accounts & Proof-of-Reserve attestations...",
    labels: [
      "Receive shared evidence",
      "Assess reserves & collateral",
      "Return custody findings",
    ],
  },
  technical: {
    name: "Smart Contract Tech",
    ensName: ENS.names.agents.technical,
    address: ENS.proxies.technicalResolver,
    avatarUrl: "/assets/agent-assets/drone.png",
    scope: "Smart contract bytecode, proxy admin controls, blacklist/freeze functions & security audits.",
    runningTelemetry: "Decompiling contract bytecode & checking admin multisig timelock...",
    labels: [
      "Receive contract evidence",
      "Assess bytecode & access roles",
      "Return technical findings",
    ],
  },
  consensus: {
    name: "Consensus Synthesizer",
    ensName: ENS.names.agents.consensus,
    address: ENS.proxies.consensusResolver,
    avatarUrl: "/assets/agent-assets/satelit2.png",
    scope: "30/40/30 weighted synthesis, multi-agent conflict resolution & Sepolia ENS record generation.",
    runningTelemetry: "Synthesizing inspector reports & mapping cryptographic verdict...",
    labels: [
      "Ingest three inspector reports",
      "Compute weighted risk matrix",
      "Finalize inspect-only verdict",
    ],
  },
};
const options = DEMO_ASSETS.filter((a) => a.marketId).map((a) => ({
  value: a.marketId!,
  label: `${a.ticker} · ${a.title}`,
  logo: a.logo,
}));
type Frame = {
  kind: string;
  label?: string;
  detail?: string;
  t?: string;
  run?: QuartetRun;
  report?: InspectorReport;
  synthesis?: Synthesis;
  usage?: QuartetRun['usage'];
  ms?: number;
};
type Entry = { file: string; recordedAt: string; run: QuartetRun };
const idle = (): Record<AgentId, AgentVisualState> => ({
  legal: "idle",
  custody: "idle",
  technical: "idle",
  consensus: "idle",
  custom: "idle",
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

/**
 * Sizes the canvas to its content at zoom 1 and pins the viewport, so the
 * page itself scrolls normally — no shrink-to-fit, no drag-to-pan tricks.
 * Runs inside <ReactFlow> to reach the flow store.
 */
function CanvasFit({
  shellRef,
  onHeight,
}: {
  shellRef: { current: HTMLDivElement | null };
  onHeight: (height: number) => void;
}) {
  const rf = useReactFlow();
  const nodes = useNodes();
  const [tick, setTick] = useState(0);
  const applied = useRef("");
  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [shellRef]);
  useEffect(() => {
    if (!nodes.length) return;
    const bounds = getNodesBounds(nodes);
    if (!bounds.width || !bounds.height) return;
    const shellWidth = shellRef.current?.clientWidth || bounds.width;
    const topPad = 32;
    const bottomPad = 64;
    // 120px accounts for .react-flow top: 48px offset, calc(100% - 90px) height, and footer clearance
    const height = Math.max(980, Math.ceil(bounds.height + topPad + bottomPad + 120));
    const viewportX =
      shellWidth >= bounds.width
        ? Math.round((shellWidth - bounds.width) / 2 - bounds.x)
        : Math.round(16 - bounds.x);
    const viewportY = Math.round(topPad - bounds.y);
    const viewport = {
      x: viewportX,
      y: viewportY,
      zoom: 1,
    };
    const key = `${height}|${viewport.x}|${viewport.y}`;
    if (applied.current === key) return;
    applied.current = key;
    onHeight(height);
    void rf.setViewport(viewport);
  }, [nodes, tick, rf, shellRef, onHeight]);
  return null;
}

export default function AgentQuartet() {
  const [subject, setSubject] = useState<string>(options[0].value);
  const [mode, setMode] = useState("official");
  const [custom, setCustom] = useState("");
  const [customAgents, setCustomAgents] = useState<string[]>([]);
  const [verifiedCustom, setVerifiedCustom] = useState<VerifiedCustomAgent | null>(null);
  const [running, setRunning] = useState(false);
  const [states, setStates] = useState(idle);
  const [completed, setCompleted] = useState<Partial<Record<AgentId, string>>>(
    {},
  );
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [liveReports, setLiveReports] = useState<Partial<Record<AgentId, InspectorReport>>>({});
  const [liveScores, setLiveScores] = useState<Partial<Record<AgentId, number>>>({});
  const [liveTokens, setLiveTokens] = useState<Partial<Record<AgentId, number>>>({});
  const [liveLatency, setLiveLatency] = useState<Partial<Record<AgentId, number>>>({});
  const [liveRationale, setLiveRationale] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [lastFrame, setLastFrame] = useState<Frame | null>(null);
  const [narrow, setNarrow] = useState(false);
  const source = useRef<EventSource | null>(null);
  const reduce = useReducedMotion();
  const shellRef = useRef<HTMLDivElement>(null);
  const [canvasHeight, setCanvasHeight] = useState(1700);
  const handleCanvasHeight = useCallback((height: number) => {
    setCanvasHeight((prev) => (prev === height ? prev : height));
  }, []);
  const loadHistory = useCallback(async () => {
    setHistoryStatus("loading");
    try {
      const response = await fetch("/api/agents/runs", { cache: "no-store" });
      if (!response.ok) throw Error();
      const body = await response.json();
      // Merge this browser's session runs (localStorage) so a fresh
      // inspection survives reloads for this user only.
      const session: Entry[] = loadSessionRuns().map((run) => ({
        file: `session:${run.id}`,
        recordedAt: run.finishedAt,
        run,
      }));
      setHistory((prev) =>
        [...prev, ...session, ...body.runs].filter(
          (e, i, all) => all.findIndex((n) => n.run.id === e.run.id) === i,
        ).sort(
          (a, b) => Date.parse(b.run.finishedAt) - Date.parse(a.run.finishedAt),
        ),
      );
      setHistoryStatus("ready");
    } catch {
      // Server unreachable — still show this browser's session runs.
      const session: Entry[] = loadSessionRuns().map((run) => ({
        file: `session:${run.id}`,
        recordedAt: run.finishedAt,
        run,
      }));
      if (session.length) {
        setHistory((prev) =>
          [...prev, ...session].filter(
            (e, i, all) => all.findIndex((n) => n.run.id === e.run.id) === i,
          ).sort(
            (a, b) => Date.parse(b.run.finishedAt) - Date.parse(a.run.finishedAt),
          ),
        );
        setHistoryStatus("ready");
      } else {
        setHistoryStatus("error");
      }
    }
  }, []);
  useEffect(() => {
    void loadHistory();
    try {
      const params = new URLSearchParams(window.location.search);
      const deepSubject = params.get("subject");
      if (deepSubject && options.some((o) => o.value === deepSubject)) {
        setSubject(deepSubject);
      }
    } catch {}
    const media = matchMedia("(max-width: 1100px)");
    const resize = () => setNarrow(media.matches);
    resize();
    media.addEventListener("change", resize);
    const saved = loadCustomAgents();
    setCustomAgents(saved);
    setCustom(saved[0] || '');
    const minted = (e: Event) => {
      const name = (e as CustomEvent<string>).detail;
      if (!validCustomAgentName(name || '')) return;
      setCustomAgents(loadCustomAgents());
      setCustom(name);
      setMode("custom");
    };
    const agentsChanged = (e: StorageEvent) => {
      if (e.key !== null && e.key !== CUSTOM_AGENTS_KEY && e.key !== LEGACY_CUSTOM_AGENT_KEY) return;
      const names = loadCustomAgents();
      setCustomAgents(names);
      setCustom((previous) => names.includes(previous) ? previous : names[0] || '');
    };
    window.addEventListener(CUSTOM_AGENT_EVENT, minted);
    window.addEventListener('storage', agentsChanged);
    // A run finished in another tab shares this browser's session store —
    // pick it up without overwriting in-memory state.
    const sessionRun = (e: Event) => {
      const run = (e as CustomEvent<QuartetRun>).detail;
      if (!run?.id) {
        void loadHistory();
        return;
      }
      setHistory((prev) =>
        [
          { file: `session:${run.id}`, recordedAt: run.finishedAt, run },
          ...prev.filter((entry) => entry.run.id !== run.id),
        ].sort(
          (a, b) => Date.parse(b.run.finishedAt) - Date.parse(a.run.finishedAt),
        ),
      );
    };
    window.addEventListener(SESSION_RUN_EVENT, sessionRun);
    window.addEventListener("storage", sessionRun);
    return () => {
      media.removeEventListener("change", resize);
      window.removeEventListener(CUSTOM_AGENT_EVENT, minted);
      window.removeEventListener('storage', agentsChanged);
      window.removeEventListener(SESSION_RUN_EVENT, sessionRun);
      window.removeEventListener("storage", sessionRun);
      source.current?.close();
    };
  }, [loadHistory]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen]);
  const activeRun = run && run.subject === subject ? run : null;
  // Custom lens card: shown when Custom lens mode has a real agent selected.
  // Layout becomes 1 (lens) - 3 (inspectors) - 1 (consensus), lens wired in.
  const customShown = mode === "custom" && validCustomAgentName(custom);
  const customActive = activeRun && activeRun.mode === "custom" && activeRun.customPolicy?.subname === custom ? activeRun : null;
  const customState: AgentVisualState = customActive ? "completed" : states["custom"];
  const customDone: string | undefined = customActive ? customActive.finishedAt : completed["custom"];

  const nodes = useMemo<AgentFlowNode[]>(
    () => {
      const base: AgentFlowNode[] = ids.map((id, i) => {
        const state = activeRun
          ? resultState(id === "consensus" ? activeRun.synthesis.verdict : activeRun.reports[id].status)
          : states[id];
        const isDone = activeRun ? activeRun.finishedAt : completed[id];
        const report = activeRun && id !== "consensus"
          ? activeRun.reports[id]
          : liveReports[id] ?? null;
        const synthesis = activeRun && id === "consensus"
          ? activeRun.synthesis
          : null;

        const score = activeRun
          ? (id === "consensus" ? activeRun.synthesis.overall_score : activeRun.reports[id]?.score)
          : liveScores[id];

        const callKey = id === "consensus" ? "synthesis" : id;
        const tokenCount = activeRun
          ? (() => {
              const u = activeRun.usage?.find((item) => item.call === callKey);
              return u ? (u.inputTokens ?? 0) + (u.outputTokens ?? 0) : null;
            })()
          : liveTokens[id] ?? null;

        const latencyMs = activeRun
          ? (activeRun.durationMs
              ? (id === "consensus" ? Math.round(activeRun.durationMs * 0.35) : Math.round((activeRun.durationMs * 0.65) / 3))
              : null)
          : liveLatency[id] ?? null;

        const cognitive: AgentCognitiveData = {
          scope: definitions[id].scope,
          liveActivity:
            lastFrame && lastFrame.label?.includes(id) && lastFrame.detail
              ? lastFrame.detail
              : definitions[id].runningTelemetry,
          findings: report?.findings ?? [],
          rationale: synthesis?.mapped?.rationale || synthesis?.reasoning_summary || (id === "consensus" ? liveRationale ?? undefined : undefined),
          telemetry: (tokenCount || latencyMs) ? { tokens: tokenCount, latencyMs } : undefined,
        };

        return {
          id,
          type: "agentTerminal",
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          initialWidth: NODE_WIDTH,
          initialHeight: NODE_HEIGHT,
          position: narrow
            ? { x: 0, y: (customShown ? i + 1 : i) * 620 + 35 }
            : {
                x: id === "consensus" ? COL_STEP : i * COL_STEP,
                y: id === "consensus" ? 720 : 35,
              },
          data: {
            ...definitions[id],
            agentId: id,
            eyebrow: i === 3 ? "04 / SYNTHESIS CORE" : `0${i + 1} / INSPECTOR`,
            state,
            score,
            steps: definitions[id].labels.map((label, step) => ({
              label,
              // Execution progress, not risk: once the agent finished
              // (isDone set), every step ran — checks all the way.
              // Risk stays on the node header ("Risk flagged") + score.
              status: isDone
                ? "completed"
                : state === "running"
                  ? step === 1
                    ? "running"
                    : step === 0
                      ? "completed"
                      : "idle"
                  : state,
              time: isDone ? time(isDone) : undefined,
            })),
            cognitive,
          },
        };
      });
      if (!customShown) return base;
      const customNode: AgentFlowNode = {
        id: "custom",
        type: "agentTerminal",
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        initialWidth: NODE_WIDTH,
        initialHeight: NODE_HEIGHT,
        position: narrow ? { x: 0, y: 35 } : { x: COL_STEP, y: -640 },
        data: {
          name: "Custom Auditor",
          ensName: custom,
          address: ENS.proxies.namespaceResolver,
          avatarUrl: "/assets/agent-assets/plane1.png",
          agentId: "custom",
          eyebrow: "05 / CUSTOM LENS",
          state: customState,
          score: undefined,
          steps: [
            "Read owner & policy live from ENS",
            "Apply lens after three inspectors",
            "Co-sign consensus verdict",
          ].map((label, step) => ({
            label,
            status: customDone
              ? "completed"
              : customState === "running"
                ? step === 1
                  ? "running"
                  : step === 0
                    ? "completed"
                    : "idle"
                : customState,
            time: customDone ? time(customDone) : undefined,
          })),
          cognitive: {
            scope: "Operator-authored audit policy applied as an extra lens on the synthesizer.",
            liveActivity: customState === "running" ? "Applying custom lens to inspector reports..." : undefined,
            findings: verifiedCustom
              ? [`Owner ${verifiedCustom.owner}`, `Policy verified at ENS block ${verifiedCustom.sourceBlock}`]
              : [],
            rationale: verifiedCustom ? verifiedCustom.policy.slice(0, 280) : undefined,
            telemetry: undefined,
          },
        },
      };
      return [customNode, ...base];
    },
    [states, completed, liveScores, liveReports, liveTokens, liveLatency, liveRationale, activeRun, narrow, lastFrame, mode, custom, verifiedCustom, customShown, customState, customDone],
  );

  const edges = [
    ...ids
      .slice(0, 3)
      .map((id, index) => ({
        id,
        source: id,
        target: "consensus",
        type: "telemetry",
        data: {
          state: activeRun && id !== "consensus"
            ? resultState(activeRun.reports[id].status)
            : states[id],
          narrow,
          lane: index,
        },
      })),
    ...(customShown
      ? [{
          id: "custom-lens",
          source: "custom",
          target: "consensus",
          type: "telemetry",
          data: { state: customState, narrow, lane: 3 },
        }]
      : []),
  ];
  function start() {
    if (running) return;
    if (
      mode === "custom" &&
      (!validCustomAgentName(custom) || verifiedCustom?.name !== custom)
    ) {
      setError("Select a deployed custom agent and wait for ENS verification.");
      return;
    }
    setError("");
    setRun(null);
    setStates(idle());
    setCompleted({});
    setLiveReports({});
    setLiveScores({});
    setLiveTokens({});
    setLiveLatency({});
    setLiveRationale(null);
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
            ([...ids, "custom"] as AgentId[]).map((id) => [id, prev[id] === "running" ? "error" : prev[id]]),
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
          const status = frame.detail?.split(" ")[0] ?? "WARN";
          setStates((prev) => ({
            ...prev,
            [id]: resultState(status),
          }));
          setCompleted((prev) => ({ ...prev, [id]: frame.t }));
          if (frame.report) {
            setLiveReports((prev) => ({ ...prev, [id]: frame.report! }));
            setLiveScores((prev) => ({ ...prev, [id]: frame.report!.score }));
          }
          if (frame.usage && frame.usage.length > 0) {
            const total = (frame.usage[0].inputTokens ?? 0) + (frame.usage[0].outputTokens ?? 0);
            setLiveTokens((prev) => ({ ...prev, [id]: total }));
          }
          if (frame.ms) {
            setLiveLatency((prev) => ({ ...prev, [id]: frame.ms }));
          }
        }
        if (frame.kind === "synthesis-start")
          setStates((prev) => ({ ...prev, consensus: "running", ...(mode === "custom" ? { custom: "running" as const } : {}) }));
        if (frame.kind === "synthesis-ok") {
          setStates((prev) => ({
            ...prev,
            consensus: frame.label?.includes("PASS") ? "completed" : "flagged",
            ...(mode === "custom" ? { custom: "completed" as const } : {}),
          }));
          setCompleted((prev) => ({ ...prev, consensus: frame.t, ...(mode === "custom" ? { custom: frame.t } : {}) }));
          if (frame.synthesis) {
            setLiveScores((prev) => ({ ...prev, consensus: frame.synthesis!.overall_score }));
            setLiveRationale(
              frame.synthesis.mapped?.rationale || frame.synthesis.reasoning_summary,
            );
          }
          if (frame.usage && frame.usage.length > 0) {
            const total = (frame.usage[0].inputTokens ?? 0) + (frame.usage[0].outputTokens ?? 0);
            setLiveTokens((prev) => ({ ...prev, consensus: total }));
          }
          if (frame.ms) {
            setLiveLatency((prev) => ({ ...prev, consensus: frame.ms }));
          }
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
          // Keep this user's run in their own browser only — it updates
          // their history, inspect page, and score list without affecting
          // anyone else.
          saveSessionRun(result);
          setCompleted((previous) => {
            const next: Partial<Record<AgentId, string>> = Object.fromEntries(
              ids.map((id) => [id, previous[id] ?? result.finishedAt]),
            );
            if (result.mode === "custom") next["custom"] = previous["custom"] ?? result.finishedAt;
            return next;
          });
          setStates({
            legal: resultState(result.reports.legal.status),
            custody: resultState(result.reports.custody.status),
            technical: resultState(result.reports.technical.status),
            consensus: resultState(result.synthesis.verdict),
            custom: result.mode === "custom" ? "completed" : "idle",
          });
          setHistory((prev) => [
            { file: result.id, recordedAt: result.finishedAt, run: result },
            ...prev.filter((e) => e.run.id !== result.id),
          ]);
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
          <span className={s.kicker}>03 / AGENT CONSENSUS</span>
          <h2 id="inspection-title">
            Independent minds.
            <br />
            <em>One clear verdict.</em>
          </h2>
          <p>
            Legal, custody, and code. Three parallel investigations converge
            into a single evidence-backed decision.
          </p>
          <p>
            AI runs offchain. Report writers are key-scoped and team-operated;
            recovery admins and name owners retain control. Hosted inspections
            do not publish transactions.{' '}
            <a href="/api/agents/permissions" target="_blank" rel="noopener noreferrer">Live permission proof ↗</a>
          </p>
        </div>
        <div className={s.headingStamp}>
          <Radio size={19} />
          <span>
            INSPECTION NETWORK<strong>{customShown ? "3 inspectors + 1 lens + 1 synthesizer" : "3 inspectors + 1 synthesizer"}</strong>
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
              {value === "official" ? "Official consensus" : "Custom lens"}
            </button>
          ))}
        </div>
        <div className="v-asset-picker" ref={pickerRef}>
          <span className={s.targetSelect} style={{ display: "block" }}>Inspection target</span>
          <button
            type="button"
            className="v-asset-picker-btn"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-label="Inspection target"
            disabled={running}
            onClick={() => setPickerOpen((o) => !o)}
          >
            {(() => {
              const selected = options.find((o) => o.value === subject) ?? options[0];
              return (
                <>
                  <img src={selected.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" />
                  <span className="v-asset-picker-label">{selected.label}</span>
                </>
              );
            })()}
          </button>
          {pickerOpen && (
            <ul className="v-asset-picker-list" role="listbox" aria-label="Inspection target">
              {options.map((option) => (
                <li key={option.value} role="option" aria-selected={option.value === subject}>
                  <button
                    type="button"
                    className="v-asset-picker-opt"
                    aria-selected={option.value === subject}
                    onClick={() => {
                      setSubject(option.value);
                      setRun(null);
                      setStates(idle());
                      setCompleted({});
                      setLiveReports({});
                      setLiveScores({});
                      setLiveTokens({});
                      setLiveLatency({});
                      setLiveRationale(null);
                      setLastFrame(null);
                      setPickerOpen(false);
                    }}
                  >
                    <img src={option.logo} alt="" width={22} height={22} loading="lazy" referrerPolicy="no-referrer" />
                    <span className="v-asset-picker-name">{option.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className={s.runButton} onClick={start} disabled={running || (mode === 'custom' && verifiedCustom?.name !== custom)}>
          {run || activeRun ? (
            <RotateCcw size={16} />
          ) : (
            <Play size={16} fill="currentColor" />
          )}
          {running ? "Inspecting…" : activeRun ? "Re-inspect fleet" : "Run inspection"}
        </button>
      </div>
      {mode === "custom" && (
        <div className={s.customLens}>
          <CustomAgentPicker names={customAgents} selected={custom} running={running}
            onSelect={(name) => { if (name !== custom) setVerifiedCustom(null); setCustom(name); }} onVerified={setVerifiedCustom} />
        </div>
      )}
      <div ref={shellRef} className={`${s.flowShell} ${narrow ? s.flowNarrow : ""}`} style={{ height: canvasHeight }}>
        <div className={s.flowLegend}>
          <span>
            <i />
            {running ? "LIVE TELEMETRY" : activeRun ? "VERIFIED TELEMETRY" : "FLEET STANDBY"}
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
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          preventScrolling={false}
          minZoom={1}
          maxZoom={1}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={28} size={1} color="rgba(140, 185, 225, 0.12)" />
          <CanvasFit shellRef={shellRef} onHeight={handleCanvasHeight} />
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
            (activeRun
              ? `Analysis on record · Overall Score: ${activeRun.synthesis.overall_score}/100 (${getUnifiedVerdict(activeRun.synthesis.policy_state)})`
              : "Fleet ready. Select an asset and launch inspection.")}
        </span>
        {lastFrame?.t ? (
          <time>{time(lastFrame.t)}</time>
        ) : activeRun?.finishedAt ? (
          <time>{time(activeRun.finishedAt)}</time>
        ) : null}
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
          history.slice(0, 20).map((entry) => {
            const catalog = DEMO_ASSETS.find((a) => a.marketId === entry.run.subject);
            const profileName =
              catalog?.name ??
              (entry.run.subject.endsWith(".eth") ? entry.run.subject : null);
            return (
              <article key={entry.run.id} className={s.historyItem}>
                <div className={s.historyTrigger} style={{ cursor: "default" }}>
                  <span className={s.historySubject}>
                    <strong>{entry.run.subject}</strong>
                    <small>
                      {entry.run.mode === "custom"
                        ? entry.run.customPolicy?.subname
                        : "Official consensus"}{" "}
                      · {Math.round(entry.run.durationMs / 1000)}s
                    </small>
                  </span>
                  <span className={s.historyScore}>
                    {entry.run.synthesis.overall_score}
                    <small>/100</small>
                  </span>
                  <time>{new Date(entry.recordedAt).toLocaleString()}</time>
                  {catalog?.marketId && (
                    <Link
                      href={`/agents/inspect/${encodeURIComponent(catalog.marketId)}`}
                      aria-label={`Open full inspection for ${entry.run.subject}`}
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
