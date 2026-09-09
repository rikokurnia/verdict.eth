import type { Evidence, VerdictState } from './policy';

export type RecordSource = {
  name: string;
  resolver: string;
  records: Record<string, string>;
};

export type VerdictApiResponse = {
  ok: boolean;
  name: string;
  chainId: number;
  sourceBlock: number | null;
  evaluatedAt: number;
  policyId: string;
  state: VerdictState;
  reason: string;
  evidence: Evidence;
  asset: {
    displayName: string;
    ticker: string;
    assetClass: string;
    issuer: string;
    documentUri: string;
    deployment: string;
    status: string;
  } | null;
  audit: {
    name: string;
    auditor: string;
    documentHash: string;
    issuedAt: number;
    expiresAt: number;
    status: string;
    ai: {
      model: string;
      confidence: number;
      rationale: string;
      sourceHash: string;
    };
  } | null;
  observation: {
    name: string;
    monitor: string;
    observedAt: number;
    severity: string;
    reasonCode: string;
    status: string;
    ai: {
      model: string;
      confidence: number;
      rationale: string;
      sourceHash: string;
    };
  } | null;
  sources: RecordSource[];
  infrastructure: {
    universalResolver: string;
    registries: string[];
  };
};
