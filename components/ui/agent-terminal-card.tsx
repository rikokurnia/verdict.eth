"use client";

import Image from "next/image";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleDashed, ExternalLink, Minus, X } from "lucide-react";
import { EnsLogo } from "@/components/app/asset-identity";
import { ENS_EXPLORER_NAME_URL, ENS_NAME_RECORDS_URL, ENS_NAME_RESOLVER_URL, ENS_RESOLVER_ROLES_URL } from "@/lib/ensv2-config";
import styles from "@/components/app/agent-orchestra.module.css";

export type AgentId = "legal" | "custody" | "technical" | "consensus";
export type AgentVisualState =
  "idle" | "running" | "completed" | "flagged" | "error";

export type AgentStep = {
  label: string;
  status: AgentVisualState;
  time?: string;
};

export type AgentCognitiveData = {
  scope: string;
  liveActivity?: string;
  findings?: string[];
  rationale?: string;
  telemetry?: {
    tokens?: number | null;
    latencyMs?: number | null;
  };
};

export type AgentNodeData = {
  agentId: AgentId;
  eyebrow: string;
  name: string;
  ensName: string;
  address: string;
  avatarUrl: string;
  state: AgentVisualState;
  score?: number;
  steps: AgentStep[];
  cognitive?: AgentCognitiveData;
};
export type AgentFlowNode = Node<AgentNodeData, "agentTerminal">;

const stateLabel: Record<AgentVisualState, string> = {
  idle: "Standing by",
  running: "Inspecting live",
  completed: "Verified",
  flagged: "Risk flagged",
  error: "Interrupted",
};

function StepIcon({ status }: { status: AgentVisualState }) {
  if (status === "completed") return <Check size={13} aria-hidden="true" />;
  if (status === "flagged" || status === "error")
    return <X size={13} aria-hidden="true" />;
  if (status === "running")
    return (
      <CircleDashed
        size={14}
        className={styles.stepSpinner}
        aria-hidden="true"
      />
    );
  return <Minus size={12} aria-hidden="true" />;
}

function AgentTerminalCard({ data }: NodeProps<AgentFlowNode>) {
  const reduceMotion = useReducedMotion();
  return (
    <article
      className={`${styles.agentNode} ${styles[`state_${data.state}`]}`}
      aria-label={`${data.name}: ${stateLabel[data.state]}`}
    >
      {data.agentId === "consensus" ? (
        <Handle
          className={styles.flowHandle}
          type="target"
          position={Position.Top}
        />
      ) : null}
      <div className={styles.nodeScanline} aria-hidden="true" />
      <header className={styles.nodeHeader}>
        <motion.div
          className={styles.avatarStage}
          animate={reduceMotion ? undefined : { y: [-3, 3, -3] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className={styles.avatarHalo} aria-hidden="true" />
          <Image
            src={data.avatarUrl}
            alt=""
            width={104}
            height={72}
            className={styles.agentAvatar}
            priority
          />
        </motion.div>
        <div className={styles.nodeIdentity}>
          <span className={styles.nodeEyebrow}>{data.eyebrow}</span>
          <h3>{data.name}</h3>
          <a
            href={data.ensName.endsWith(".eth") ? ENS_EXPLORER_NAME_URL(data.ensName) : `https://eth-sepolia.blockscout.com/address/${data.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.ensLink} nodrag nopan`}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            title={data.ensName.endsWith(".eth") ? `View ${data.ensName} in the hackathon ENSv2 Explorer` : data.address}
          >
            <EnsLogo size={13} />
            <span>{data.ensName}</span>
            <ExternalLink size={11} className={styles.ensLinkIcon} aria-hidden="true" />
          </a>
          {data.ensName.endsWith(".eth") ? (
            <div
              className={`${styles.explorerProof} nodrag nopan`}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={styles.explorerProofLabel}>
                <img src="/assets/ens-explorer-logo.png" width={13} height={13} alt="" />
                ENSv2 Explorer proof:
              </span>
              <span className={styles.explorerProofLinks}>
                <a href={ENS_NAME_RECORDS_URL(data.ensName)} target="_blank" rel="noopener noreferrer" aria-label={`Inspect ${data.ensName} records`}>Records ↗</a>
                <a href={ENS_NAME_RESOLVER_URL(data.ensName)} target="_blank" rel="noopener noreferrer" aria-label={`Inspect ${data.ensName} resolver permissions`}>Resolver ↗</a>
                <a href={ENS_RESOLVER_ROLES_URL(data.address)} target="_blank" rel="noopener noreferrer" aria-label={`Inspect ${data.ensName} scoped writer roles`}>Roles ↗</a>
              </span>
            </div>
          ) : null}
        </div>
        {typeof data.score === "number" ? (
          <div
            className={styles.nodeScore}
            aria-label={`Score ${data.score} out of 100`}
          >
            <strong>{data.score}</strong>
            <span>/100</span>
          </div>
        ) : null}
      </header>
      <div className={styles.nodeStatus}>
        <span className={styles.statusBeacon} aria-hidden="true" />
        <span>{stateLabel[data.state]}</span>
        <span className={styles.nodeProtocol}>ENSv2</span>
      </div>
      <ol className={styles.stepList}>
        {data.steps.map((step, index) => (
          <li
            key={step.label}
            className={`${styles.agentStep} ${styles[`step_${step.status}`]}`}
          >
            <span className={styles.stepRail} aria-hidden="true" />
            <span className={styles.stepIcon}>
              <StepIcon status={step.status} />
            </span>
            <span className={styles.stepCopy}>
              <span>{step.label}</span>
              <small>{step.time ?? `0${index + 1} · awaiting telemetry`}</small>
            </span>
          </li>
        ))}
      </ol>
      {data.cognitive ? (
        <div className={styles.cognitiveSection}>
          <div className={styles.cognitiveHeader}>
            <span className={styles.cognitiveKicker}>
              {data.state === "running"
                ? "EVALUATING STREAM"
                : data.state === "completed" || data.state === "flagged"
                  ? data.agentId === "consensus"
                    ? "SYNTHESIZED RATIONALE"
                    : "AI EVALUATION"
                  : "AUDIT SCOPE"}
            </span>
            {data.state === "running" && (
              <span className={styles.pulseBeacon} aria-hidden="true" />
            )}
          </div>

          {data.state === "running" ? (
            <div className={styles.cognitiveBodyRunning}>
              <span className={styles.streamCursor}>_</span>
              <span>{data.cognitive.liveActivity || "Processing live evidence and authority contracts..."}</span>
            </div>
          ) : (data.state === "completed" || data.state === "flagged") ? (
            <div className={styles.cognitiveBody}>
              {data.agentId === "consensus" && data.cognitive.rationale ? (
                <p className={styles.cognitiveRationale}>
                  &ldquo;{data.cognitive.rationale}&rdquo;
                </p>
              ) : data.cognitive.findings && data.cognitive.findings.length > 0 ? (
                <ul className={styles.cognitiveFindings}>
                  {data.cognitive.findings.slice(0, 2).map((finding, idx) => (
                    <li key={idx}>
                      <span className={styles.findingBullet}>•</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.cognitiveScopeText}>Evaluation concluded without flags.</p>
              )}
              {data.cognitive.telemetry ? (
                <div className={styles.cognitiveTelemetry}>
                  <span>TELEMETRY</span>
                  <span className={styles.telemetryDot}>·</span>
                  <span>{data.cognitive.telemetry.tokens ? `${data.cognitive.telemetry.tokens.toLocaleString()} TOKENS` : "ONCHAIN BINDING"}</span>
                  {data.cognitive.telemetry.latencyMs ? (
                    <>
                      <span className={styles.telemetryDot}>·</span>
                      <span>{(data.cognitive.telemetry.latencyMs / 1000).toFixed(1)}S</span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.cognitiveBody}>
              <p className={styles.cognitiveScopeText}>
                {data.cognitive.scope || "Awaiting target asset telemetry."}
              </p>
            </div>
          )}
        </div>
      ) : null}
      {data.agentId !== "consensus" ? (
        <Handle
          className={styles.flowHandle}
          type="source"
          position={Position.Bottom}
        />
      ) : null}
    </article>
  );
}

export default memo(AgentTerminalCard);
