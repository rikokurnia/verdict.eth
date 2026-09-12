"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { ColoredScore } from "@/components/app/status-badge";
import { ENSV2_SEPOLIA as ENS } from "@/lib/ensv2-config";
import type { QuartetRun } from "@/lib/agents/types";
import s from "./agent-orchestra.module.css";

const ids = ["legal", "custody", "technical", "consensus"] as const;
const names: Record<(typeof ids)[number], string> = {
  legal: "Legal & Compliance",
  custody: "Custody & Backing",
  technical: "Smart Contract Tech",
  consensus: "Consensus Synthesizer",
};

function ageOf(finishedAt: string) {
  const ageSec = Math.max(0, Math.floor(Date.now() / 1000 - Date.parse(finishedAt) / 1000));
  if (ageSec < 3600) return "scored just now";
  if (ageSec < 86_400) return `scored ${Math.floor(ageSec / 3600)}h ago`;
  return `scored ${Math.floor(ageSec / 86_400)}d ago`;
}

function bigScoreClass(score?: number | null) {
  if (typeof score !== "number" || !Number.isFinite(score)) return s.bigScoreGray;
  if (score >= 75) return s.bigScoreGreen;
  if (score >= 50) return s.bigScoreYellow;
  return s.bigScoreRed;
}

/** Full 4-agent conclusion: inspectors, synthesis, and onchain write proofs. */
export default function RunDetails({ run }: { run: QuartetRun }) {
  return (
    <div className={s.runDetails}>
      <div className={s.summary}>
        <div>
          <span className={s.kicker}>Consensus synthesis · {ageOf(run.finishedAt)}</span>
          <p style={{ marginTop: 12 }}>{run.synthesis.reasoning_summary}</p>
        </div>
        <div className={`${s.bigScore} ${bigScoreClass(run.synthesis.overall_score)}`}>
          {run.synthesis.overall_score}
          <small>/100 · composite score</small>
        </div>
      </div>
      <div className={s.findings}>
        {ids.map((id) => (
          <section key={id}>
            <h4>{names[id]}</h4>
            {id === "consensus" ? (
              <>
                <div className={s.inspectorScoreRow}>
                  <ColoredScore score={run.synthesis.overall_score} />
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
                  <ColoredScore score={run.reports[id].score} />
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
