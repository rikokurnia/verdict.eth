"use client";

import Image from "next/image";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { motion, useReducedMotion } from "motion/react";
import { Check, CircleDashed, ExternalLink, Minus, X } from "lucide-react";
import { EnsLogo } from "@/components/app/asset-identity";
import { ENS_EXPLORER_NAME_URL } from "@/lib/ensv2-config";
import styles from "@/components/app/agent-orchestra.module.css";

export type AgentId = "legal" | "custody" | "technical" | "consensus";
export type AgentVisualState =
  "idle" | "running" | "completed" | "flagged" | "error";

export type AgentStep = {
  label: string;
  status: AgentVisualState;
  time?: string;
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
