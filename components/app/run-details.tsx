"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { ColoredScore } from "@/components/app/status-badge";
import { ENSV2_SEPOLIA as ENS, ENS_REGISTRY_URL } from "@/lib/ensv2-config";
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

function parseProofSource(raw: string): { href: string; label: string; domain: string } | null {
  const match = raw.match(/https?:\/\/[^\s)\],]+/i);
  if (!match) return null;
  const cleanUrl = match[0].replace(/[.,;:)]+$/, '');

  try {
    const parsed = new URL(cleanUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname;

    // 1. Blockscout (API or Web Explorer)
    if (host.includes('blockscout.com')) {
      const isApi = path.includes('/api/v2/smart-contracts/');
      const addr = isApi ? path.split('/').pop() : path.match(/0x[a-fA-F0-9]{40}/)?.[0];
      const href = addr ? `https://${parsed.hostname}/address/${addr}` : cleanUrl;
      const addrShort = addr ? ` (${addr.slice(0, 6)}…${addr.slice(-4)})` : '';
      return {
        href,
        label: `Blockscout Verified${addrShort}`,
        domain: 'blockscout.com',
      };
    }

    // 2. Etherscan
    if (host.includes('etherscan.io')) {
      const addrMatch = path.match(/0x[a-fA-F0-9]{40}/);
      const addrShort = addrMatch ? ` (${addrMatch[0].slice(0, 6)}…${addrMatch[0].slice(-4)})` : '';
      return {
        href: cleanUrl,
        label: `Etherscan Contract${addrShort}`,
        domain: 'etherscan.io',
      };
    }

    // 3. CoinGecko
    if (host.includes('coingecko.com')) {
      return {
        href: cleanUrl,
        label: 'CoinGecko Market Feed',
        domain: 'coingecko.com',
      };
    }

    // 4. Recognized Issuer Platforms
    if (host.includes('securitize.io')) return { href: cleanUrl, label: 'Securitize Issuer Portal', domain: 'securitize.io' };
    if (host.includes('hashnote.com')) return { href: cleanUrl, label: 'Hashnote Disclosures', domain: 'hashnote.com' };
    if (host.includes('ondo.finance')) return { href: cleanUrl, label: 'Ondo Finance Disclosures', domain: 'ondo.finance' };
    if (host.includes('franklintempleton.com')) return { href: cleanUrl, label: 'Franklin Templeton Portal', domain: 'franklintempleton.com' };
    if (host.includes('superstate.co')) return { href: cleanUrl, label: 'Superstate Issuer Platform', domain: 'superstate.co' };
    if (host.includes('centrifuge.io')) return { href: cleanUrl, label: 'Centrifuge Protocol', domain: 'centrifuge.io' };
    if (host.includes('blockchain.capital')) return { href: cleanUrl, label: 'Blockchain Capital Portal', domain: 'blockchain.capital' };
    if (host.includes('figure.com')) return { href: cleanUrl, label: 'Figure Issuer Platform', domain: 'figure.com' };
    if (host.includes('tether.to')) return { href: cleanUrl, label: 'Tether Gold Disclosures', domain: 'tether.to' };
    if (host.includes('paxos.com')) return { href: cleanUrl, label: 'Paxos Official Source', domain: 'paxos.com' };
    if (host.includes('kinesis.money')) return { href: cleanUrl, label: 'Kinesis Money Platform', domain: 'kinesis.money' };
    if (host.includes('maple.finance')) return { href: cleanUrl, label: 'Maple Protocol', domain: 'maple.finance' };
    if (host.includes('xstocks.fi')) return { href: cleanUrl, label: 'xStocks Catalog', domain: 'xstocks.fi' };
    if (host.includes('ens.domains')) return { href: cleanUrl, label: 'ENS Registry Record', domain: 'ens.domains' };

    // General fallback: formatted brand name
    const parts = host.split('.');
    const brand = parts.length >= 2 ? parts[parts.length - 2] : host;
    const capitalized = brand.charAt(0).toUpperCase() + brand.slice(1);
    return {
      href: cleanUrl,
      label: `${capitalized} Source`,
      domain: host,
    };
  } catch {
    return {
      href: cleanUrl,
      label: 'Evidence Link',
      domain: 'ethereum.org',
    };
  }
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
                {(() => {
                  const seen = new Set<string>();
                  const sources = run.reports[id].evidence_urls
                    .map(parseProofSource)
                    .filter((item): item is NonNullable<typeof item> => {
                      if (!item || seen.has(item.href)) return false;
                      seen.add(item.href);
                      return true;
                    });
                  if (!sources.length) return null;
                  return (
                    <div className={s.proofLinks}>
                      {sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.href}
                          target="_blank"
                          rel="noreferrer"
                          className={s.sourceLink}
                          title={`Open proof source: ${src.href}`}
                        >
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${src.domain}&sz=32`}
                            alt=""
                            width={14}
                            height={14}
                            className={s.sourceFavicon}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className={s.sourceLabel}>{src.label}</span>
                          <ArrowUpRight size={12} className={s.sourceArrow} aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  );
                })()}
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
          href={ENS_REGISTRY_URL(ENS.proxies.verdictRegistry)}
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
