'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import { AssetLogo } from '@/components/app/asset-identity';
import { CoverageBadge } from '@/components/app/asset-identity';
import { StatusBadge } from '@/components/app/status-badge';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [runsRes, seedRes] = await Promise.all([
          fetch('/api/agents/runs', { cache: 'no-store', signal: controller.signal }),
          fetch('/api/agents/seed', { cache: 'no-store', signal: controller.signal }),
        ]);
        if (runsRes.ok) {
          const body = (await runsRes.json()) as { runs?: HistoryEntry[] };
          const latest = (body.runs ?? []).map((e) => e.run).find((r) => r.subject === marketId) ?? null;
          setRun(latest);
        }
        if (seedRes.ok) {
          const body = (await seedRes.json()) as { receipts?: SeedReceipt[] };
          for (const entry of body.receipts ?? []) {
            const hit = entry.receipt.results.find((r) => r.marketId === marketId && r.transaction);
            if (hit?.transaction) {
              setTx(hit.transaction);
              break;
            }
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
    <>
      <Link href="/dashboard" className="v-btn v-btn-secondary" style={{ textDecoration: 'none', width: 'fit-content' }}>
        <ArrowLeft size={14} aria-hidden="true" />Back to radar
      </Link>
      {asset ? (
        <PageHead title={`Full inspection · ${asset.ticker}`} sub={`${asset.title} — every inspector conclusion and its onchain receipt.`} />
      ) : (
        <PageHead title="Full inspection" sub="Resolve the latest agent conclusion for this asset." />
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
    </>
  );
}
