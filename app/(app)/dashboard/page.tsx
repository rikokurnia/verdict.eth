'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Diamond,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  FileCheck2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Fingerprint,
} from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS, DEMO_ACTIVITY } from '@/components/app/demo-data';
import { evaluate, type Evidence, type VerdictState } from '@/lib/policy';

const initialEvidence: Evidence = {
  daysRemaining: 30,
  fresh: true,
  revoked: false,
  available: true,
  riskConflict: false,
};

export default function DashboardPage() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VerdictState>('ALL');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // Interactive Policy Playground state
  const [playgroundEvidence, setPlaygroundEvidence] = useState<Evidence>(initialEvidence);
  const [activeScenario, setActiveScenario] = useState<string>('valid');
  const playgroundResult = evaluate(playgroundEvidence);

  function handleScenario(kind: string) {
    setActiveScenario(kind);
    if (kind === 'expiry') {
      setPlaygroundEvidence({ ...initialEvidence, daysRemaining: 0 });
    } else if (kind === 'review') {
      setPlaygroundEvidence({ ...initialEvidence, daysRemaining: 7 });
    } else if (kind === 'offline') {
      setPlaygroundEvidence({ ...initialEvidence, available: false });
    } else {
      setPlaygroundEvidence(initialEvidence);
    }
  }

  const query = q.trim().toLowerCase();
  const filteredAssets = DEMO_ASSETS.filter((a) => {
    const matchesQuery =
      !query ||
      a.title.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query) ||
      a.ticker.toLowerCase().includes(query) ||
      a.issuer.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'ALL' || a.state === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const passCount = DEMO_ASSETS.filter((a) => a.state === 'POLICY_PASS').length;
  const reviewCount = DEMO_ASSETS.filter((a) => a.state === 'REVIEW').length;
  const blockedCount = DEMO_ASSETS.filter((a) => a.state === 'BLOCKED').length;

  async function copyName(name: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(name);
      setCopiedName(name);
      setTimeout(() => setCopiedName(null), 1800);
    } catch {}
  }

  return (
    <>
      {/* Overview Top Command Section */}
      <div className="v-overview-heading">
        <div>
          <div className="v-overview-eyebrow">
            <span className="v-eyebrow-dot" aria-hidden="true" />
            <span>THE EVIDENCE WORKSPACE</span>
            <span className="v-eyebrow-sep">·</span>
            <span>CANONICAL PROTOCOL STATE</span>
          </div>
          <PageHead
            title="Every asset. In perspective."
            sub="Independent sources. Transparent decisions. Explore the evidence behind your ENS-bound assets in this live transparent workspace."
          />
        </div>

        <div className="v-overview-search">
          <Search size={16} aria-hidden="true" className="v-search-icon" />
          <input
            className="v-search-big"
            placeholder="Search asset, ENS name, or ticker…  ⌘K"
            aria-label="Search assets"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="v-search-clear" onClick={() => setQ('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="v-filter-tabs-bar" role="tablist" aria-label="Filter assets by verdict">
        <span className="v-filter-label">FILTER STATE:</span>
        <button
          role="tab"
          aria-selected={statusFilter === 'ALL'}
          className={`v-filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All Assets <span className="v-tab-count">{DEMO_ASSETS.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={statusFilter === 'POLICY_PASS'}
          className={`v-filter-tab v-tab-pass ${statusFilter === 'POLICY_PASS' ? 'active' : ''}`}
          onClick={() => setStatusFilter('POLICY_PASS')}
        >
          <span className="v-tab-dot v-dot-pass" />
          Policy Pass <span className="v-tab-count">{passCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={statusFilter === 'REVIEW'}
          className={`v-filter-tab v-tab-review ${statusFilter === 'REVIEW' ? 'active' : ''}`}
          onClick={() => setStatusFilter('REVIEW')}
        >
          <span className="v-tab-dot v-dot-review" />
          Need Review <span className="v-tab-count">{reviewCount}</span>
        </button>
        <button
          role="tab"
          aria-selected={statusFilter === 'BLOCKED'}
          className={`v-filter-tab v-tab-blocked ${statusFilter === 'BLOCKED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('BLOCKED')}
        >
          <span className="v-tab-dot v-dot-blocked" />
          Blocked <span className="v-tab-count">{blockedCount}</span>
        </button>

        {statusFilter !== 'ALL' && (
          <button
            className="v-filter-reset"
            onClick={() => setStatusFilter('ALL')}
            aria-label="Reset filter"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* 4 Transparent Metric Cards */}
      <div className="v-grid v-cards-4">
        {[
          {
            label: 'Total assets',
            val: DEMO_ASSETS.length,
            sub: 'Sepolia demo set',
            filter: 'ALL' as const,
            icon: Diamond,
            accent: 'total',
          },
          {
            label: 'Policy pass',
            val: passCount,
            sub: 'Fresh evidence · 25%',
            filter: 'POLICY_PASS' as const,
            icon: CheckCircle2,
            accent: 'pass',
          },
          {
            label: 'Need review',
            val: reviewCount,
            sub: 'Expiry < 14d · 25%',
            filter: 'REVIEW' as const,
            icon: AlertTriangle,
            accent: 'review',
          },
          {
            label: 'Blocked',
            val: blockedCount,
            sub: 'Expired / revoked · 50%',
            filter: 'BLOCKED' as const,
            icon: XCircle,
            accent: 'blocked',
          },
        ].map((card) => {
          const Icon = card.icon;
          const isSelected = statusFilter === card.filter;
          const pct = Math.round((card.val / DEMO_ASSETS.length) * 100);

          return (
            <button
              key={card.label}
              className={`v-card v-metric-card v-metric-${card.accent} ${
                isSelected ? 'v-metric-active' : ''
              }`}
              onClick={() => setStatusFilter(statusFilter === card.filter ? 'ALL' : card.filter)}
              type="button"
            >
              <div className="v-metric-top">
                <div className="v-label">{card.label}</div>
                <Icon size={18} strokeWidth={1.5} className="v-metric-icon" />
              </div>
              <div className="v-metric">{card.val}</div>
              <div className="v-muted">{card.sub}</div>
              <div className="v-metric-line" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="v-card-crosshair" aria-hidden="true">
                +
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Intelligence Workspace */}
      <div className="v-split">
        {/* Left Column: Asset Verdicts Table & Activity */}
        <div className="v-main-column">
          {/* Asset Verdicts Table Card */}
          <div className="v-card v-glass-card">
            <div className="v-card-header">
              <div>
                <div className="v-card-tag">01 / LEDGER PERSPECTIVE</div>
                <h3 className="v-section-title">Asset Verdicts</h3>
                <p className="v-muted">
                  Deterministic verdict per asset. Always paired with independent reasons.
                </p>
              </div>
              <div className="v-card-header-badge">
                <span>{filteredAssets.length} of {DEMO_ASSETS.length} RESOLVED</span>
              </div>
            </div>

            <div className="v-table-wrap">
              <table className="v-table">
                <thead>
                  <tr>
                    <th>Asset & Canonical ENS</th>
                    <th>Verdict</th>
                    <th>Audit Evidence</th>
                    <th>Risk Signal</th>
                    <th>Network</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((a) => (
                    <tr key={a.name} className="v-asset-row">
                      <td>
                        <Link
                          className="v-rowlink"
                          href={`/assets/${encodeURIComponent(a.name)}`}
                        >
                          <div className="v-asset-name-group">
                            <span className="v-asset-name">{a.title}</span>
                            <span className="v-asset-badge">{a.ticker}</span>
                          </div>
                          <div className="v-asset-sub-row">
                            <span className="v-asset-sub">{a.name}</span>
                            <button
                              className="v-inline-copy-btn"
                              onClick={(e) => copyName(a.name, e)}
                              aria-label={`Copy ENS name ${a.name}`}
                              title="Copy ENS name"
                            >
                              {copiedName === a.name ? (
                                <Check size={11} className="v-copied-icon" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <StatusChip state={a.state} />
                      </td>
                      <td>
                        <div className="v-cell-main">{a.auditNote}</div>
                        <div className="v-cell-sub">by audit-001.auditor.eth</div>
                      </td>
                      <td>
                        <div className="v-cell-main">{a.riskNote}</div>
                        <div className="v-cell-sub">hb: {a.heartbeat}</div>
                      </td>
                      <td>
                        <span className="v-table-network">{a.network}</span>
                      </td>
                      <td>
                        <Link
                          href={`/assets/${encodeURIComponent(a.name)}`}
                          className="v-table-action-link"
                          aria-label={`Inspect ${a.title}`}
                        >
                          Inspect <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {!filteredAssets.length && (
                    <tr>
                      <td colSpan={6} className="v-table-empty">
                        <div className="v-empty-box">
                          <Search size={22} className="v-empty-icon" />
                          <p>No assets match current query or filter.</p>
                          <button
                            className="v-btn v-btn-secondary"
                            onClick={() => {
                              setQ('');
                              setStatusFilter('ALL');
                            }}
                          >
                            Reset filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Protocol Activity Card */}
          <div className="v-card v-glass-card" style={{ marginTop: 20 }}>
            <div className="v-card-header">
              <div>
                <div className="v-card-tag">02 / PROTOCOL HEARTBEAT</div>
                <h3 className="v-section-title">Recent Activity</h3>
                <p className="v-muted">
                  Real-time attestation, expiry checks, and authority permission events on Sepolia.
                </p>
              </div>
              <Link href="/activity" className="v-text-link">
                View full log <ArrowUpRight size={14} />
              </Link>
            </div>

            <div className="v-activity-list">
              {DEMO_ACTIVITY.map((e) => (
                <div className="v-activity-item" key={e.tx}>
                  <div className="v-activity-left">
                    <span className="v-activity-badge">{e.label}</span>
                    <div className="v-activity-desc">{e.text}</div>
                  </div>
                  <div className="v-activity-meta">
                    <span className="v-activity-time">{e.time}</span>
                    <span className="v-mono v-activity-tx">{e.tx} ↗</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Authority Stack & Interactive Simulator */}
        <div className="v-side-column">
          {/* Authority Stack Card */}
          <div className="v-card v-glass-card">
            <div className="v-card-header">
              <div>
                <div className="v-card-tag">AUTHORITY ORBIT</div>
                <h3 className="v-section-title">Authority Stack</h3>
                <p className="v-muted">Independent controllers behind every proof.</p>
              </div>
              <Link href="/authorities" className="v-text-link">
                Matrix <ArrowUpRight size={13} />
              </Link>
            </div>

            <div className="v-authority-list">
              <div className="v-authority-item">
                <div className="v-auth-info">
                  <div className="v-auth-role">
                    <ShieldCheck size={14} className="v-auth-icon" />
                    <strong>Issuer Authority</strong>
                  </div>
                  <span className="v-auth-ens">acme.verdict.eth</span>
                </div>
                <span className="v-ok">
                  <CheckCircle2 size={14} /> Healthy
                </span>
              </div>

              <div className="v-authority-item">
                <div className="v-auth-info">
                  <div className="v-auth-role">
                    <FileCheck2 size={14} className="v-auth-icon" />
                    <strong>Auditor Attestation</strong>
                  </div>
                  <span className="v-auth-ens">audit-001.auditor.eth</span>
                </div>
                <span className="v-warn">
                  <AlertTriangle size={14} /> 1 Expiring
                </span>
              </div>

              <div className="v-authority-item">
                <div className="v-auth-info">
                  <div className="v-auth-role">
                    <Radio size={14} className="v-auth-icon" />
                    <strong>Risk Sentinel</strong>
                  </div>
                  <span className="v-auth-ens">sentinel-01.risk.eth</span>
                </div>
                <span className="v-bad">
                  <XCircle size={14} /> 1 Stale
                </span>
              </div>
            </div>

            <div className="v-authority-callout">
              <span className="v-callout-crosshair">+</span>
              <span className="v-callout-text">
                Permissions are scoped per ENS node. No single actor can rewrite another authority’s
                proofs.
              </span>
            </div>
          </div>

          {/* Interactive Policy Playground (Matching Landing Page Demo) */}
          <div className="v-card v-glass-card" style={{ marginTop: 20 }}>
            <div className="v-card-header">
              <div>
                <div className="v-card-tag">SIMULATION SUITE</div>
                <h3 className="v-section-title">Evidence Playground</h3>
                <p className="v-muted">Toggle evidence states to observe deterministic resolution.</p>
              </div>
              <Sparkles size={16} className="v-sparkle-icon" />
            </div>

            {/* Scenario buttons */}
            <div className="v-playground-scenarios">
              {[
                { id: 'valid', n: '01', title: 'In agreement', desc: 'Valid audit & fresh signal' },
                { id: 'expiry', n: '02', title: 'Let audit expire', desc: '0 days left on proof' },
                { id: 'review', n: '03', title: 'Near deadline', desc: 'Audit < 14 days' },
                { id: 'offline', n: '04', title: 'Resolver offline', desc: 'Read failure' },
              ].map((s) => (
                <button
                  key={s.id}
                  className={`v-scen-btn ${activeScenario === s.id ? 'active' : ''}`}
                  onClick={() => handleScenario(s.id)}
                  type="button"
                >
                  <span className="v-scen-num">{s.n}</span>
                  <div className="v-scen-text">
                    <strong>{s.title}</strong>
                    <span>{s.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Live Result Box */}
            <div
              className={`v-playground-result v-verdict-${playgroundResult.state.toLowerCase()}`}
            >
              <div className="v-pg-top">
                <span>SIMULATED VERDICT</span>
                <span className="v-pg-state">
                  <span className="v-status-dot" />
                  {playgroundResult.state}
                </span>
              </div>
              <p className="v-pg-reason">{playgroundResult.reason}</p>

              <div className="v-pg-facts">
                <div className="v-pg-fact-row">
                  <span>Independent audit:</span>
                  <strong>
                    {playgroundEvidence.daysRemaining > 0
                      ? `${playgroundEvidence.daysRemaining}d remaining`
                      : 'Expired'}
                  </strong>
                </div>
                <div className="v-pg-fact-row">
                  <span>Risk heartbeat:</span>
                  <strong>{playgroundEvidence.available ? 'Fresh (12s)' : 'Resolver Offline'}</strong>
                </div>
                <div className="v-pg-fact-row">
                  <span>Authority access:</span>
                  <strong>Enforced</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
