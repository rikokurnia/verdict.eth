import type { VerdictState } from '@/lib/policy';

export type InspectorId = 'legal' | 'custody' | 'technical';
export type InspectorStatus = 'PASS' | 'WARN' | 'FAIL';
export type Grounding = 'live' | 'curated' | 'unknown';

export type InspectorReport = {
  agent: string;
  score: number;
  status: InspectorStatus;
  findings: string[];
  evidence_urls: string[];
  grounding: Record<string, Grounding>;
  // Agent-specific verified fields (all optional — unknown stays unknown).
  issuer_entity?: string;
  jurisdiction?: string;
  regulatory_framework?: string;
  custodian?: string;
  spv_structure?: string;
  latest_attestation_date?: string;
  attestation_auditor?: string;
  attestation_document_url?: string;
  contract_address?: string;
  chain_id?: number;
  is_upgradeable?: boolean;
  admin_controller?: string;
  has_blacklist_or_freeze?: boolean;
  audit_firm?: string;
  audit_hash?: string;
  contract_verified?: boolean;
};

export type Synthesis = {
  asset_symbol: string;
  overall_score: number;
  verdict: InspectorStatus;
  /** Mapped onto the deterministic onchain policy — the only thing that gates. */
  policy_state: VerdictState;
  reasoning_summary: string;
  mapped: {
    auditStatus: 'active' | 'revoked';
    severity: 'info' | 'warning' | 'high' | 'critical';
    reasonCode: string;
    confidence: number;
    validityDays: number;
    rationale: string;
  };
  ensv2_records: Record<string, string>;
};

export type EvidencePack = {
  subject: string;
  subjectKind: 'catalog-rwa' | 'ens-demo-asset';
  catalog?: {
    title: string;
    ticker: string;
    issuer: string;
    assetClass: string;
    networks: string[];
    sourceLabel: string;
    sourceUrl: string;
    description: string;
  };
  curated?: {
    entity?: string;
    administrator?: string;
    domicile?: string;
    framework?: string;
    eligibility?: string;
    custodian?: string;
    asOf?: string;
  };
  market?: { usd: number; change24h: number | null; updatedAt: number | null } | null;
  contract?: { address: string; chain: string; explorerUrl: string } | null;
  verification?: {
    name: string | null;
    isVerified: boolean | null;
    isProxy: boolean | null;
    source: string;
  } | null;
  issuerPage?: { url: string; reachable: boolean; title: string | null } | null;
  /** Live ENS evidence when the subject is the demo asset. */
  ensEvidence?: {
    state: string;
    reason: string;
    daysRemaining: number;
    fresh: boolean;
    revoked: boolean;
    riskConflict: boolean;
    auditStatus: string;
    severity: string;
    reasonCode: string;
    confidence: number;
    sourceBlock: number | null;
  } | null;
  builtAt: string;
};

export type CallEngine = { provider: string; model: string };

export type QuartetRun = {
  id: string;
  subject: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  model: string;
  /** Which engine served each call (failover can mix providers in one run). */
  engines: Record<'legal' | 'custody' | 'technical' | 'synthesis', CallEngine>;
  /** Billed token usage per call, when the provider reports it. */
  usage: { call: string; provider: string; model: string; inputTokens: number | null; outputTokens: number | null }[];
  reports: Record<InspectorId, InspectorReport>;
  synthesis: Synthesis;
  evidenceSummary: {
    contractAddress: string | null;
    contractVerified: boolean | null;
    marketUsd: number | null;
    issuerReachable: boolean | null;
  };
  write: {
    requested: boolean;
    performed: boolean;
    reason: string;
    transactions?: {
      audit?: { hash: string; blockNumber: number };
      risk?: { hash: string; blockNumber: number };
    };
  };
};

export const INSPECTOR_STATUS_TO_POLICY: Record<InspectorStatus, VerdictState> = {
  PASS: 'POLICY_PASS',
  WARN: 'REVIEW',
  FAIL: 'BLOCKED',
};

const REASON_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,39}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateInspectorReport(id: InspectorId, value: unknown): InspectorReport {
  if (!isRecord(value)) throw new Error(`Agent ${id} returned no report object`);
  const status = value.status;
  if (status !== 'PASS' && status !== 'WARN' && status !== 'FAIL') throw new Error(`Agent ${id}: invalid status`);
  const score = value.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`Agent ${id}: invalid score`);
  }
  const findings = value.findings;
  if (!Array.isArray(findings) || findings.length === 0 || findings.some((f) => typeof f !== 'string')) {
    throw new Error(`Agent ${id}: findings must be a non-empty string array`);
  }
  const evidenceUrls = value.evidence_urls;
  if (!Array.isArray(evidenceUrls) || evidenceUrls.some((u) => typeof u !== 'string')) {
    throw new Error(`Agent ${id}: evidence_urls must be a string array`);
  }
  const grounding = isRecord(value.grounding) ? value.grounding : {};
  for (const [k, v] of Object.entries(grounding)) {
    if (v !== 'live' && v !== 'curated' && v !== 'unknown') throw new Error(`Agent ${id}: bad grounding for ${k}`);
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    agent: str(value.agent) ?? id,
    score: Math.round(score),
    status,
    findings: findings as string[],
    evidence_urls: evidenceUrls as string[],
    grounding: grounding as Record<string, Grounding>,
    issuer_entity: str(value.issuer_entity),
    jurisdiction: str(value.jurisdiction),
    regulatory_framework: str(value.regulatory_framework),
    custodian: str(value.custodian),
    spv_structure: str(value.spv_structure),
    latest_attestation_date: str(value.latest_attestation_date),
    attestation_auditor: str(value.attestation_auditor),
    attestation_document_url: str(value.attestation_document_url),
    contract_address: str(value.contract_address),
    chain_id: num(value.chain_id),
    is_upgradeable: bool(value.is_upgradeable),
    admin_controller: str(value.admin_controller),
    has_blacklist_or_freeze: bool(value.has_blacklist_or_freeze),
    audit_firm: str(value.audit_firm),
    audit_hash: str(value.audit_hash),
    contract_verified: bool(value.contract_verified),
  };
}

const SEVERITIES = new Set(['info', 'warning', 'high', 'critical']);

export function validateSynthesis(value: unknown): Synthesis {
  if (!isRecord(value)) throw new Error('Synthesizer returned no object');
  const verdict = value.verdict;
  if (verdict !== 'PASS' && verdict !== 'WARN' && verdict !== 'FAIL') throw new Error('Synthesizer: invalid verdict');
  const overall = value.overall_score;
  if (typeof overall !== 'number' || !Number.isFinite(overall) || overall < 0 || overall > 100) {
    throw new Error('Synthesizer: invalid overall_score');
  }
  const mapped = value.mapped;
  if (!isRecord(mapped)) throw new Error('Synthesizer: missing mapped policy fields');
  if (mapped.auditStatus !== 'active' && mapped.auditStatus !== 'revoked') throw new Error('Synthesizer: bad mapped.auditStatus');
  if (typeof mapped.severity !== 'string' || !SEVERITIES.has(mapped.severity)) throw new Error('Synthesizer: bad mapped.severity');
  if (typeof mapped.reasonCode !== 'string' || !REASON_CODE_PATTERN.test(mapped.reasonCode)) {
    throw new Error('Synthesizer: bad mapped.reasonCode');
  }
  const { confidence, validityDays, rationale } = mapped;
  if (!Number.isInteger(confidence) || (confidence as number) < 0 || (confidence as number) > 95) {
    throw new Error('Synthesizer: bad mapped.confidence');
  }
  if (!Number.isInteger(validityDays) || (validityDays as number) < 1 || (validityDays as number) > 90) {
    throw new Error('Synthesizer: bad mapped.validityDays');
  }
  if (typeof rationale !== 'string' || rationale.length < 10 || rationale.length > 280) {
    throw new Error('Synthesizer: bad mapped.rationale');
  }
  const records = isRecord(value.ensv2_records) ? value.ensv2_records : {};
  return {
    asset_symbol: typeof value.asset_symbol === 'string' ? value.asset_symbol : 'UNKNOWN',
    overall_score: Math.round(overall),
    verdict,
    policy_state: INSPECTOR_STATUS_TO_POLICY[verdict],
    reasoning_summary: typeof value.reasoning_summary === 'string' ? value.reasoning_summary : '',
    mapped: {
      auditStatus: mapped.auditStatus,
      severity: mapped.severity as Synthesis['mapped']['severity'],
      reasonCode: mapped.reasonCode,
      confidence: confidence as number,
      validityDays: validityDays as number,
      rationale,
    },
    ensv2_records: Object.fromEntries(Object.entries(records).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
  };
}
