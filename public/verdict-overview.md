# Verdict

One name. Every reason.

Verdict connects tokenized asset identities to independent issuer, auditor, and risk evidence through ENS.

## Policy

- POLICY_PASS: audit valid with at least 14 days remaining; risk evidence fresh.
- REVIEW: audit has fewer than 14 days remaining.
- BLOCKED: audit expired, attestation revoked, stale risk heartbeat, or conflicting risk evidence.
- UNAVAILABLE: resolver or network read failed.

The landing page is an illustrative local example. It does not perform onchain verification or guarantee investment safety.

## Intended architecture

Independent authorities maintain scoped records. The issuer cannot rewrite the independent auditor's evidence. Expiry and revocation represent the lifecycle of trust. People and agents discover the same sources through one asset name.

Demo asset: usd-yield-001.acme.verdict.eth (fictional).
