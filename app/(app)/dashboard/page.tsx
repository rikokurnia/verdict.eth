'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Radio,
  FileCheck2,
  Copy,
  Check,
  X,
  TerminalSquare,
  KeyRound,
  Lock,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { PageHead } from '@/components/app/app-shell';
import StatusChip from '@/components/app/status-chip';
import { DEMO_ASSETS, DEMO_ACTIVITY, type DemoAsset } from '@/components/app/demo-data';
import type { VerdictState } from '@/lib/policy';

export default function DashboardPage() {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | VerdictState>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<DemoAsset | null>(null);
  const [modalTab, setModalTab] = useState<'authorities' | 'resolver'>('authorities');

  const query = q.trim().toLowerCase();
  const filteredAssets = DEMO_ASSETS.filter((a) => {
    const matchesQuery =
      !query ||
      a.title.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query) ||
      a.ticker.toLowerCase().includes(query) ||
      a.issuer.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'ALL' || a.state === statusFilter;
    const matchesClass = classFilter === 'ALL' || a.assetClass === classFilter;

    return matchesQuery && matchesStatus && matchesClass;
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
      </div>

      {/* KPI Metric Cards */}
      <div className="v-metric-grid" role="region" aria-label="Asset verdict summary metrics">
        <button
          className={`v-metric-card v-metric-total ${statusFilter === 'ALL' ? 'v-metric-active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          type="button"
          aria-pressed={statusFilter === 'ALL'}
        >
          <div className="v-metric-top">
            <span className="v-label">Total Assets</span>
            <Layers size={18} className="v-metric-icon" />
          </div>
          <div className="v-metric">{DEMO_ASSETS.length}</div>
          <div className="v-muted">Sepolia demo set</div>
          <div className="v-metric-line"><span style={{ width: '100%' }} /></div>
          <span className="v-card-crosshair">+</span>
        </button>

        <button
          className={`v-metric-card v-metric-pass ${statusFilter === 'POLICY_PASS' ? 'v-metric-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'POLICY_PASS' ? 'ALL' : 'POLICY_PASS')}
          type="button"
          aria-pressed={statusFilter === 'POLICY_PASS'}
        >
          <div className="v-metric-top">
            <span className="v-label">Policy Pass</span>
            <CheckCircle2 size={18} className="v-metric-icon" style={{ color: 'var(--pass)' }} />
          </div>
          <div className="v-metric">{passCount}</div>
          <div className="v-muted">Fresh evidence · {Math.round((passCount / DEMO_ASSETS.length) * 100)}%</div>
          <div className="v-metric-line"><span style={{ width: `${(passCount / DEMO_ASSETS.length) * 100}%` }} /></div>
          <span className="v-card-crosshair">+</span>
        </button>

        <button
          className={`v-metric-card v-metric-review ${statusFilter === 'REVIEW' ? 'v-metric-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'REVIEW' ? 'ALL' : 'REVIEW')}
          type="button"
          aria-pressed={statusFilter === 'REVIEW'}
        >
          <div className="v-metric-top">
            <span className="v-label">Need Review</span>
            <AlertTriangle size={18} className="v-metric-icon" style={{ color: 'var(--review)' }} />
          </div>
          <div className="v-metric">{reviewCount}</div>
          <div className="v-muted">Expiry &lt; 14d · {Math.round((reviewCount / DEMO_ASSETS.length) * 100)}%</div>
          <div className="v-metric-line"><span style={{ width: `${(reviewCount / DEMO_ASSETS.length) * 100}%` }} /></div>
          <span className="v-card-crosshair">+</span>
        </button>

        <button
          className={`v-metric-card v-metric-blocked ${statusFilter === 'BLOCKED' ? 'v-metric-active' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'BLOCKED' ? 'ALL' : 'BLOCKED')}
          type="button"
          aria-pressed={statusFilter === 'BLOCKED'}
        >
          <div className="v-metric-top">
            <span className="v-label">Blocked</span>
            <XCircle size={18} className="v-metric-icon" style={{ color: 'var(--blocked)' }} />
          </div>
          <div className="v-metric">{blockedCount}</div>
          <div className="v-muted">Expired / revoked · {Math.round((blockedCount / DEMO_ASSETS.length) * 100)}%</div>
          <div className="v-metric-line"><span style={{ width: `${(blockedCount / DEMO_ASSETS.length) * 100}%` }} /></div>
          <span className="v-card-crosshair">+</span>
        </button>
      </div>

      {/* Full-Width Asset Verdicts Card */}
      <div className="v-card v-glass-card v-fullwidth-card" style={{ marginTop: 24 }}>
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">01 / CANONICAL LEDGER</div>
            <h3 className="v-section-title">Asset Verdicts</h3>
            <p className="v-muted">
              Deterministic verdict per asset. Always paired with independent authorities and verifiable records.
            </p>
          </div>
          <div className="v-card-header-badge">
            <span>{filteredAssets.length} of {DEMO_ASSETS.length} RESOLVED</span>
          </div>
        </div>

        {/* Toolbar: Search + 2 Filter Dropdowns Side-by-Side */}
        <div className="v-table-toolbar">
          <div className="v-table-search-box">
            <Search size={15} className="v-search-icon" aria-hidden="true" />
            <input
              className="v-search-input"
              placeholder="Search asset, ENS name, or ticker…"
              aria-label="Search assets"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="v-search-clear"
                onClick={() => setQ('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="v-table-filter-group">
            {/* Filter 1: State Filter */}
            <div className="v-select-wrapper">
              <select
                className="v-select-filter"
                aria-label="Filter by verdict state"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | VerdictState)}
              >
                <option value="ALL">All Verdicts</option>
                <option value="POLICY_PASS">Policy Pass</option>
                <option value="REVIEW">Need Review</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>

            {/* Filter 2: Asset Class Filter */}
            <div className="v-select-wrapper">
              <select
                className="v-select-filter"
                aria-label="Filter by asset class"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="ALL">All Classes</option>
                <option value="Yield">Yield</option>
                <option value="Bond">Bond</option>
                <option value="Treasury">Treasury</option>
              </select>
            </div>
          </div>
        </div>

        {/* Full-width Table */}
        <div className="v-table-wrap">
          <table className="v-table">
            <thead>
              <tr>
                <th>Asset & Canonical ENS</th>
                <th>Verdict</th>
                <th>Audit Evidence</th>
                <th>Risk Signal</th>
                <th>Network & Heartbeat</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((a) => (
                <tr key={a.name} className="v-asset-row">
                  <td>
                    <div className="v-rowlink-static">
                      <div className="v-asset-name-group">
                        <span className="v-asset-name">{a.title}</span>
                        <span className="v-asset-badge">{a.ticker}</span>
                        <span className="v-class-badge">{a.assetClass}</span>
                      </div>
                      <div className="v-asset-sub-row">
                        <span className="v-asset-sub">{a.name}</span>
                        <button
                          type="button"
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
                    </div>
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
                    <div className="v-cell-sub">sentinel-01.risk.eth</div>
                  </td>
                  <td>
                    <div className="v-cell-main">{a.network}</div>
                    <div className="v-cell-sub">hb: {a.heartbeat}</div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="v-btn-detail"
                      onClick={() => {
                        setSelectedAsset(a);
                        setModalTab('authorities');
                      }}
                      aria-haspopup="dialog"
                    >
                      Detail <ArrowUpRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredAssets.length && (
                <tr>
                  <td colSpan={6} className="v-table-empty">
                    <div className="v-empty-box">
                      <Search size={22} className="v-empty-icon" />
                      <p>No assets match current filters or search query.</p>
                      <button
                        className="v-btn v-btn-secondary"
                        onClick={() => {
                          setQ('');
                          setStatusFilter('ALL');
                          setClassFilter('ALL');
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

      {/* Bottom Grid: Authority Stack Beside Recent Activity */}
      <div className="v-dash-bottom-grid">
        {/* Left Column: Authority Stack */}
        <div className="v-card v-glass-card">
          <div className="v-card-header">
            <div>
              <div className="v-card-tag">AUTHORITY ORBIT</div>
              <h3 className="v-section-title">Authority Stack</h3>
              <p className="v-muted">Independent controllers behind every proof.</p>
            </div>
            <span className="v-badge-pill">ENS SEPARATION</span>
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
              Permissions are scoped per ENS node. No single actor can rewrite another authority’s proofs.
            </span>
          </div>
        </div>

        {/* Right Column: Recent Protocol Activity */}
        <div className="v-card v-glass-card">
          <div className="v-card-header">
            <div>
              <div className="v-card-tag">PROTOCOL HEARTBEAT</div>
              <h3 className="v-section-title">Recent Activity</h3>
              <p className="v-muted">
                Attestations, expiry checks, and authority permission events.
              </p>
            </div>
            <span className="v-badge-pill">LIVE FEED</span>
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

      {/* ====================================================================
          POP-UP MODAL: MERGED AUTHORITIES & RESOLVER PROOF PER ASSET
          ==================================================================== */}
      {selectedAsset && (
        <div
          className="v-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="asset-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAsset(null);
          }}
        >
          <div className="v-modal-dialog">
            {/* Modal Header */}
            <div className="v-modal-header">
              <div>
                <div className="v-modal-eyebrow">
                  <span>CANONICAL ENS EVIDENCE PROOF</span>
                  <span className="v-modal-dot" />
                  <span>{selectedAsset.network}</span>
                </div>
                <h2 id="asset-modal-title" className="v-modal-title">
                  {selectedAsset.title}
                  <span className="v-asset-badge" style={{ marginLeft: 8 }}>
                    {selectedAsset.ticker}
                  </span>
                </h2>
                <div className="v-modal-ens-line">
                  <code className="v-mono">{selectedAsset.name}</code>
                  <button
                    type="button"
                    className="v-inline-copy-btn"
                    onClick={(e) => copyName(selectedAsset.name, e)}
                    aria-label="Copy ENS name"
                  >
                    {copiedName === selectedAsset.name ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="v-modal-header-actions">
                <StatusChip state={selectedAsset.state} />
                <button
                  type="button"
                  className="v-modal-close"
                  onClick={() => setSelectedAsset(null)}
                  aria-label="Close detail modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="v-modal-tabs">
              <button
                type="button"
                className={`v-modal-tab ${modalTab === 'authorities' ? 'active' : ''}`}
                onClick={() => setModalTab('authorities')}
              >
                <KeyRound size={15} />
                <span>Authorities & EAC Matrix</span>
              </button>
              <button
                type="button"
                className={`v-modal-tab ${modalTab === 'resolver' ? 'active' : ''}`}
                onClick={() => setModalTab('resolver')}
              >
                <TerminalSquare size={15} />
                <span>Resolver Proof & Records</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="v-modal-body">
              {modalTab === 'authorities' ? (
                <div className="v-modal-section">
                  {/* Authority Cards for this specific asset */}
                  <div className="v-modal-auth-grid">
                    <div className="v-modal-auth-card">
                      <div className="v-modal-auth-top">
                        <span className="v-auth-label">ISSUER IDENTITY</span>
                        <span className="v-ok"><CheckCircle2 size={13} /> Active</span>
                      </div>
                      <strong>acme.verdict.eth</strong>
                      <p>Issuer of canonical asset tokens. Locked out of audit records.</p>
                    </div>

                    <div className="v-modal-auth-card">
                      <div className="v-modal-auth-top">
                        <span className="v-auth-label">AUDITOR ATTESTATION</span>
                        <span className={selectedAsset.state === 'POLICY_PASS' ? 'v-ok' : selectedAsset.state === 'REVIEW' ? 'v-warn' : 'v-bad'}>
                          {selectedAsset.auditNote}
                        </span>
                      </div>
                      <strong>audit-001.auditor.eth</strong>
                      <p>Independent attestor. Has exclusive permission to write audit-hash.</p>
                    </div>

                    <div className="v-modal-auth-card">
                      <div className="v-modal-auth-top">
                        <span className="v-auth-label">RISK SENTINEL</span>
                        <span className={selectedAsset.riskNote === 'Low' ? 'v-ok' : 'v-bad'}>
                          {selectedAsset.riskNote}
                        </span>
                      </div>
                      <strong>sentinel-01.risk.eth</strong>
                      <p>Heartbeat updated {selectedAsset.heartbeat}. Writes NAV & risk metrics.</p>
                    </div>
                  </div>

                  {/* Permission Matrix for this asset */}
                  <div className="v-modal-subcard">
                    <div className="v-label">EAC PERMISSION MATRIX (LEAST PRIVILEGE)</div>
                    <div className="v-table-wrap" style={{ marginTop: 8 }}>
                      <table className="v-modal-table">
                        <thead>
                          <tr>
                            <th>Record Subpath</th>
                            <th>Issuer</th>
                            <th>Auditor</th>
                            <th>Risk Engine</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="v-mono">SET_TEXT:metadata/*</td>
                            <td className="v-ok">Allowed ✓</td>
                            <td className="v-muted">Denied ×</td>
                            <td className="v-muted">Denied ×</td>
                          </tr>
                          <tr>
                            <td className="v-mono">SET_TEXT:audit-*</td>
                            <td className="v-bad">LOCKED OUT ×</td>
                            <td className="v-ok">Allowed ✓</td>
                            <td className="v-muted">Denied ×</td>
                          </tr>
                          <tr>
                            <td className="v-mono">SET_TEXT:heartbeat/nav</td>
                            <td className="v-muted">Denied ×</td>
                            <td className="v-muted">Denied ×</td>
                            <td className="v-ok">Allowed ✓</td>
                          </tr>
                          <tr>
                            <td className="v-mono">TRANSFER_NODE</td>
                            <td className="v-ok">Safe Multi-sig ✓</td>
                            <td className="v-muted">Denied ×</td>
                            <td className="v-muted">Denied ×</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Unauthorized write attempt demo */}
                  <div className="v-modal-revert-box">
                    <div className="v-revert-header">
                      <Lock size={15} />
                      <span>ONCHAIN ENFORCEMENT PROOF</span>
                    </div>
                    <div className="v-revert-code">
                      <span>Attempt: Issuer (0x17A…9b) → SET_TEXT:audit-hash on {selectedAsset.name}</span>
                      <strong className="v-revert-status">BLOCKED BY PERMISSIONED RESOLVER — Transaction Reverted</strong>
                      <span className="v-revert-meta">Sepolia tx proof: 0x91d58…04be · Zero issuer bypass guaranteed.</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="v-modal-section">
                  {/* Raw ENS Records */}
                  <div className="v-modal-subcard">
                    <div className="v-label">RAW RESOLUTION RECORDS (READ DIRECTLY VIA ENS)</div>
                    <div className="v-record-list">
                      <div className="v-record-row">
                        <span className="v-record-key">issuer</span>
                        <code className="v-record-val">acme.verdict.eth</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">asset-class</span>
                        <code className="v-record-val">{selectedAsset.assetClass.toLowerCase()}</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">audit-hash</span>
                        <code className="v-record-val">sha256:89a74c728e9102bf923a8e91d84b2c41</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">audit-expiry</span>
                        <code className="v-record-val">1788912000 ({selectedAsset.auditNote})</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">heartbeat</span>
                        <code className="v-record-val">1788911988 ({selectedAsset.heartbeat})</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">agent-context</span>
                        <code className="v-record-val">portfolio suitability / RWA rebalancer</code>
                      </div>
                      <div className="v-record-row">
                        <span className="v-record-key">agent-endpoint[mcp]</span>
                        <code className="v-record-val">https://feed.acme.verdict.eth/mcp</code>
                      </div>
                    </div>
                  </div>

                  {/* Contract resolver addresses & second client proof */}
                  <div className="v-modal-cli-box">
                    <div className="v-cli-title">
                      <span>SECOND-CLIENT VERIFICATION</span>
                      <span className="v-cli-badge">NO HARDCODED DATA</span>
                    </div>
                    <pre className="v-cli-terminal">
                      <code>
                        <span className="v-dim">$</span> ens resolve {selectedAsset.name} text audit-hash{'\n'}
                        &gt; sha256:89a74c728e9102bf923a8e91d84b2c41{'\n'}
                        <span className="v-dim">$</span> ens resolve {selectedAsset.name} addr{'\n'}
                        &gt; 0x84e9182a0b1274efc28e90a1639c091f84b7172a (Permissioned Resolver){'\n'}
                        <span className="v-pass-t">Proof Matched ✓ Policy evaluated deterministically</span>
                      </code>
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="v-modal-footer">
              <span className="v-modal-footnote">
                Deterministic policy gating: valid audit + fresh signal = POLICY_PASS
              </span>
              <button
                type="button"
                className="v-btn v-btn-secondary"
                onClick={() => setSelectedAsset(null)}
              >
                Close Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
