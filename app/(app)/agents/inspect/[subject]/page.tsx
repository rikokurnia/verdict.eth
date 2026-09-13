'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo, CoverageBadge, EnsLogo, OfficialDeployments } from '@/components/app/asset-identity';
import { ColoredScore } from '@/components/app/status-badge';
import RunDetails from '@/components/app/run-details';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA, ENS_EXPLORER_NAME_URL } from '@/lib/ensv2-config';
import type { EnsProfile } from '@/lib/ens-profile';
import type { QuartetRun } from '@/lib/agents/types';
import {
  SESSION_RUN_EVENT,
  findSessionRun,
} from '@/lib/session-runs';

type HistoryEntry = { file: string; recordedAt: string; run: QuartetRun };
type SeedTx = { hash: string; blockNumber: number };
type SeedReceipts = { receipts?: { receipt: { results: { marketId?: string; transaction?: SeedTx }[] } }[] };

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export default function InspectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = use(params);
  const marketId = decodeURIComponent(subject);
  const asset = DEMO_ASSETS.find((a) => a.marketId === marketId);
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [isSessionRun, setIsSessionRun] = useState(false);
  const [tx, setTx] = useState<SeedTx | null>(null);
  const [snapshot, setSnapshot] = useState<{
    status: string;
    score: number | null;
    reason: string;
    summary: string;
    runAt: number | null;
    underlying: string;
    standard: string;
    eligibility: string;
    custodian: string;
    fundAdmin: string;
    auditor: string;
    oracleFeed: string;
    docs: string;
  } | null>(null);
  const [ensProfile, setEnsProfile] = useState<EnsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const applySession = () => {
      // This browser's own latest run wins for this user only — other
      // users keep seeing the shared record.
      try {
        const session = findSessionRun(marketId);
        if (!session) return;
        setRun((prev) => {
          if (prev && prev.id === session.id) return prev;
          if (prev && prev.finishedAt > session.finishedAt) return prev;
          setIsSessionRun(true);
          return session;
        });
      } catch {
        // Session store unavailable — shared record stands.
      }
    };
    (async () => {
      try {
        const [runsRes, seedRes, profileRes] = await Promise.all([
          fetch('/api/agents/runs', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/agents/seed', { cache: 'no-store', signal: controller.signal }),
          asset ? fetch(`/api/profile?name=${encodeURIComponent(asset.name)}`, { cache: 'no-store', signal: controller.signal }) : Promise.resolve(null),
        ]);
        if (runsRes.ok) {
          const body = (await runsRes.json()) as { runs?: HistoryEntry[] };
          const match = body.runs?.find((r) => r.run.subject === marketId);
          if (match) {
            setRun((prev) => {
              const session = (() => {
                try {
                  return findSessionRun(marketId);
                } catch {
                  return null;
                }
              })();
              if (session && session.finishedAt >= match.run.finishedAt && (!prev || prev.id !== session.id)) {
                setIsSessionRun(true);
                return session;
              }
              setIsSessionRun(false);
              return match.run;
            });
          } else {
            applySession();
          }
        } else {
          applySession();
        }
        if (seedRes.ok) {
          const body = (await seedRes.json()) as SeedReceipts;
          for (const entry of body.receipts ?? []) {
            const hit = entry.receipt.results.find((r) => r.marketId === marketId && r.transaction);
            if (hit?.transaction) {
              setTx({
                hash: hit.transaction.hash,
                blockNumber: hit.transaction.blockNumber,
              });
              break;
            }
          }
        }
        if (profileRes && profileRes.ok) {
          const profile = (await profileRes.json()) as EnsProfile;
          if (profile.ok) {
            setEnsProfile(profile);
            const score = Number(profile.records?.['verdict.quartet.score']);
            const runAt = Number(profile.records?.['verdict.quartet.runAt']);
            setSnapshot({
              status: profile.records?.['verdict.quartet.status'] || '—',
              score: Number.isFinite(score) ? score : null,
              reason: profile.records?.['verdict.quartet.reason'] || '',
              summary: profile.records?.['verdict.quartet.summary'] || '',
              runAt: Number.isFinite(runAt) && runAt > 0 ? runAt : null,
              underlying: profile.records?.['asset.underlying'] || '',
              standard: profile.records?.['token.standard'] || '',
              eligibility: profile.records?.['investor.eligibility'] || '',
              custodian: profile.records?.['provider.custodian'] || '',
              fundAdmin: profile.records?.['provider.fundadmin'] || profile.records?.['provider.transfer_agent'] || '',
              auditor: profile.records?.['provider.auditor'] || '',
              oracleFeed: profile.records?.['oracle.feed'] || profile.records?.['oracle.por'] || '',
              docs: profile.records?.['docs.official'] || '',
            });
          }
        }
        if (!asset) setError('Unknown catalog asset.');
      } catch {
        if (!controller.signal.aborted) setError('Inspection data unavailable. Retry when connectivity returns.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    window.addEventListener(SESSION_RUN_EVENT, applySession);
    window.addEventListener('storage', applySession);
    return () => {
      controller.abort();
      window.removeEventListener(SESSION_RUN_EVENT, applySession);
      window.removeEventListener('storage', applySession);
    };
  }, [marketId, asset]);

  const underlying = snapshot?.underlying || asset?.underlying;
  const standard = snapshot?.standard || asset?.tokenStandard;
  const eligibility = snapshot?.eligibility || asset?.investorEligibility;
  const custodian = snapshot?.custodian || asset?.custodian;
  const fundAdmin = snapshot?.fundAdmin || asset?.fundAdmin;
  const auditor = snapshot?.auditor || asset?.auditor;
  const oracleFeed = snapshot?.oracleFeed || asset?.oracleFeed;
  const docs = snapshot?.docs || asset?.officialDocsUrl;

  return (
    <div className="v-page v-inspect-page">
      <PageHead
        title={asset ? `${asset.title} · Full inspection` : 'Inspection conclusion'}
        sub="Verifiable consensus synthesis written by four specialized AI agents to ENS Sepolia."
      />

      <div style={{ marginBottom: 16 }}>
        <Link className="v-btn v-btn-secondary" href="/agents" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Agent Quartet
        </Link>
      </div>

      {asset && (
        <div style={{ marginBottom: 12 }}>
          <a
            className="v-btn v-btn-secondary"
            href={ENS_EXPLORER_NAME_URL(asset.name)}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title={`View ${asset.name} in the hackathon ENSv2 Explorer`}
          >
            <EnsLogo size={14} />
            <span>ENS: {asset.name}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {loading && <p className="v-muted" role="status">Loading latest conclusion…</p>}
      {error && !loading && <p className="v-block-t" role="alert">{error}</p>}

      {!loading && !error && asset && (
        <>
          <div className="v-card v-glass-card v-fullwidth-card">
            <div className="v-card-header">
              <div className="v-dialog-identity">
                <AssetLogo asset={asset} size={52} />
                <div>
                  <div className="v-modal-eyebrow"><span>{asset.assetClass}</span><span className="v-modal-dot" /><span>{asset.ticker}</span></div>
                  <h2 className="v-modal-title">{asset.title}</h2>
                  <CoverageBadge coverage={asset.coverage} />
                </div>
              </div>
            </div>
            <p className="v-asset-description" style={{ marginTop: 12 }}>{asset.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="v-source-snapshot">{asset.snapshot}</span>
              <span className="v-cell-sub">· {asset.snapshotAsOf}</span>
            </div>
          </div>

          <div className="v-matrix-grid">
            <div className="v-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="v-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={14} style={{ color: 'var(--accent-cyan, #38bdf8)' }} />
                  <span>Institutional Service Provider Matrix</span>
                </div>
                <span className="v-badge-pill" style={{ textTransform: 'uppercase', fontSize: 10 }}>ENS Registry Layer</span>
              </div>
              <p className="v-muted" style={{ fontSize: 12, marginBottom: 14 }}>
                Trust anchors and institutional roles anchored to ENS subname identity per the ENS tokenized assets standard.
              </p>
              <dl className="v-kv">
                <dt>Custodian</dt>
                <dd>
                  <strong>{custodian || 'Independent Qualified Custodian'}</strong>
                  <div style={{ fontSize: 11, color: '#7995ab' }}>Bankruptcy-remote asset safekeeping & segregation</div>
                </dd>
                <dt>Fund Admin / Agent</dt>
                <dd>
                  <strong>{fundAdmin || 'Regulated Transfer Agent'}</strong>
                  <div style={{ fontSize: 11, color: '#7995ab' }}>Cap-table, mint/burn permissions & investor registry</div>
                </dd>
                <dt>Independent Auditor</dt>
                <dd>
                  <strong>{auditor || 'Independent Certified Auditor'}</strong>
                  <div style={{ fontSize: 11, color: '#7995ab' }}>Third-party reserve attestations & periodic audit</div>
                </dd>
                <dt>Oracle Feed</dt>
                <dd>
                  <strong>{oracleFeed || 'Onchain NAV / PoR Oracle'}</strong>
                  <div style={{ fontSize: 11, color: '#7995ab' }}>Automated proof-of-reserve & pricing feed</div>
                </dd>
              </dl>
            </div>

            <div className="v-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="v-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} style={{ color: 'var(--accent-blue, #60a5fa)' }} />
                  <span>Structure & Compliance Specification</span>
                </div>
                <span className="v-badge-pill" style={{ textTransform: 'uppercase', fontSize: 10 }}>Specification</span>
              </div>
              <p className="v-muted" style={{ fontSize: 12, marginBottom: 14 }}>
                Underlying collateral allocation, token standard, and regulatory investor eligibility.
              </p>
              <dl className="v-kv">
                <dt>Underlying Collateral</dt>
                <dd>{underlying || 'Disclosed institutional collateral'}</dd>
                <dt>Token Standard</dt>
                <dd className="v-mono">{standard || 'ERC-20'}</dd>
                <dt>Investor Eligibility</dt>
                <dd>{eligibility || 'Qualified / Accredited holders'}</dd>
                <dt>Primary Issuance</dt>
                <dd>{asset.network}</dd>
                <dt>Deployments</dt>
                <dd>
                  <OfficialDeployments
                    asset={asset}
                    profile={ensProfile}
                  />
                </dd>
              </dl>
            </div>
          </div>

          <div className="v-card" style={{ marginTop: 16 }}>
            <div className="v-label" style={{ marginBottom: 10 }}>Documentation & Provenance Proofs</div>
            <dl className="v-kv">
              {docs && (
                <>
                  <dt>Official Disclosures</dt>
                  <dd>
                    <a
                      href={docs}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}
                    >
                      <span>Prospectus & Terms of Issuance ({docs.replace(/^https?:\/\//, '').split('/')[0]})</span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </a>
                  </dd>
                </>
              )}
              <dt>ENSv2 Verification</dt>
              <dd>
                <a
                  href={ENS_EXPLORER_NAME_URL(asset.name)}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}
                >
                  <img src="/assets/ens-explorer-logo.png" alt="" width="14" height="14" />
                  <span>Inspect {asset.name} on ENSv2 Explorer</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              </dd>
              <dt>Issuer & Source</dt>
              <dd>{asset.sourceLabel} · <a href={asset.sourceUrl} target="_blank" rel="noreferrer">{asset.sourceUrl} ↗</a></dd>
            </dl>
          </div>

          {run ? (
            <div style={{ marginTop: 16 }}>
              {isSessionRun && (
                <p className="v-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Your session result — visible only in this browser until the conclusion is published onchain.
                </p>
              )}
              <RunDetails run={run} />
            </div>
          ) : snapshot && snapshot.score !== null ? (
            <div className="v-card" style={{ marginTop: 16 }}>
              <div className="v-label">Onchain conclusion · transcript archived</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
                <ColoredScore score={snapshot.score} style={{ fontSize: 18 }} />
                {snapshot.reason && (
                  <span className="v-muted" style={{ fontSize: 13 }}>· {snapshot.reason}</span>
                )}
              </div>
              <p style={{ fontSize: 14 }}>{snapshot.summary}</p>
              <p className="v-muted">Full agent transcript is not in the recent local window — re-run from the radar to inspect it live.</p>
            </div>
          ) : (
            <div className="v-card" style={{ marginTop: 16 }}>
              <div className="v-label">No inspection recorded</div>
              <p className="v-muted">This asset has no recorded agent run yet. Trigger a curator refresh from the radar.</p>
            </div>
          )}

          <div className="v-card" style={{ marginTop: 16 }}>
            <div className="v-label">Onchain receipt</div>
            {tx ? (
              <dl className="v-kv" style={{ marginTop: 10 }}>
                <dt>Snapshot tx</dt>
                <dd className="v-mono">
                  <a href={`${ENSV2_SEPOLIA.explorer}/tx/${tx.hash}`} target="_blank" rel="noreferrer">
                    {shortHash(tx.hash)} ↗
                  </a>{' '}· block {tx.blockNumber}
                </dd>
                <dt>Profile</dt>
                <dd className="v-mono" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <EnsLogo size={13} />
                  <span>{asset.name}</span>{' '}
                  <a href={ENS_EXPLORER_NAME_URL(asset.name)} target="_blank" rel="noreferrer" title={`Open ${asset.name} in ENSv2 Explorer`}><ExternalLink size={12} aria-hidden="true" /></a>
                </dd>
              </dl>
            ) : (
              <p className="v-muted">No snapshot transaction recorded for this asset yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
