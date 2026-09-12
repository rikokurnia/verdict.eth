'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo } from '@/components/app/asset-identity';
import { CoverageBadge } from '@/components/app/asset-identity';
import { StatusBadge, InspectorRiskBadge } from '@/components/app/status-badge';
import RunDetails from '@/components/app/run-details';
import { DEMO_ASSETS } from '@/components/app/demo-data';
import { ENSV2_SEPOLIA } from '@/lib/ensv2-config';
import type { QuartetRun } from '@/lib/agents/types';

type HistoryEntry = { file: string; recordedAt: string; run: QuartetRun };
type SeedTx = { hash: string; blockNumber: number };
type SeedReceipt = { receipt: { results: { marketId?: string; transaction?: SeedTx }[] } };

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export default function InspectPage({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = use(params);
  const marketId = decodeURIComponent(subject);
  const asset = DEMO_ASSETS.find((a) => a.marketId === marketId);
  const [run, setRun] = useState<QuartetRun | null>(null);
  const [tx, setTx] = useState<SeedTx | null>(null);
  const [snapshot, setSnapshot] = useState<{ status: string; score: number | null; reason: string; summary: string; runAt: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
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
          if (match) setRun(match.run);
        }
        if (seedRes.ok) {
          const body = (await seedRes.json()) as SeedReceipt;
          const match = body.receipt.results.find((r) => r.marketId === marketId);
          if (match?.transaction) {
            setTx({
              hash: match.transaction.hash,
              blockNumber: match.transaction.blockNumber,
            });
          }
        }
        if (profileRes && profileRes.ok) {
          const profile = (await profileRes.json()) as { ok: boolean; records: Record<string, string> };
          if (profile.ok) {
            const score = Number(profile.records['verdict.quartet.score']);
            const runAt = Number(profile.records['verdict.quartet.runAt']);
            setSnapshot({
              status: profile.records['verdict.quartet.status'] || '—',
              score: Number.isFinite(score) ? score : null,
              reason: profile.records['verdict.quartet.reason'] || '',
              summary: profile.records['verdict.quartet.summary'] || '',
              runAt: Number.isFinite(runAt) && runAt > 0 ? runAt : null,
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
    return () => controller.abort();
  }, [marketId, asset]);

  return (
    <div className="v-page">
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
            href={`https://app.ens.domains/${encodeURIComponent(asset.name)}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title={`View official ENS record for ${asset.name}`}
          >
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
              <a className="v-btn v-btn-secondary" href={`/assets/${encodeURIComponent(asset.name)}`}>
                Onchain ENS proof<ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>

          {run ? (
            <div style={{ marginTop: 16 }}>
              <RunDetails run={run} />
            </div>
          ) : snapshot && snapshot.score !== null ? (
            <div className="v-card" style={{ marginTop: 16 }}>
              <div className="v-label">Onchain conclusion · transcript archived</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                <InspectorRiskBadge status={snapshot.status} score={snapshot.score} size="md" />
                <span className="v-mono" style={{ fontSize: 12 }}>{snapshot.score}/100 · {snapshot.reason}</span>
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
                <dd className="v-mono">
                  {asset.name}{' '}
                  <a href={`/assets/${encodeURIComponent(asset.name)}`}><ExternalLink size={12} aria-hidden="true" /></a>
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
