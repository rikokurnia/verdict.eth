# Verdict (`verdict.eth`)

> Autonomous, decentralized trust & verification registry for tokenized Real World Assets (RWAs), powered by ENSv2.

Verdict turns an ENS asset name into a deterministic institutional decision engine. By leveraging ENSv2's hierarchical structure and Enhanced Access Control (EAC), Verdict separates authority between Asset Issuers, Independent Auditors, and Risk Monitors—providing cryptographically verifiable, machine-readable trust for onchain finance.

---

## ⚡ Architecture Overview

Verdict establishes a trust hierarchy where separate authorities control their respective records without risk of parent revocation or unauthorized overrides:

```
verdict.eth (Root Registry)
 └── acme.verdict.eth (Issuer)
      └── usd-yield-001.acme.verdict.eth (Canonical Asset Identity)
           ├── Identity Records (Ticker, Documents, Metadata) -> Issuer authority
           ├── Attestation Records -> audit-001.verdict-auditor.eth
           └── Risk Signals -> risk-001.verdict-monitor.eth
```

The auditor and monitor use separate resolver proxies, signing wallets, and
recovery-admin wallets. Their AI workers have `ROLE_SET_TEXT` only for eight
explicit dynamic keys each. They have no root text permission and cannot
upgrade their resolvers. Fixed subject and authority bindings are not writable
by the workers.

### Deterministic Policy Engine
Evaluates asset evidence in real time into 4 discrete states:
- **`POLICY_PASS`**: All audits valid and risk signals fresh.
- **`REVIEW`**: Approaching expiry window (< 14 days) or pending updates.
- **`BLOCKED`**: Audit expired, attestation revoked, or conflicting risk signal.
- **`UNAVAILABLE`**: Resolver read failure or network timeout.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router), React 19, TypeScript
- **Styling & Motion**: Vanilla CSS, GSAP, Archivo Variable Typography
- **Protocol**: [ENSv2](https://ens.domains/) (Hierarchical Registry, Enhanced Access Control, UniversalResolverV2)
- **AI evidence classification**: Gemini structured JSON with local semantic validation
- **Onchain components**: Deployed ENSv2 Permissioned Registries and Permissioned Resolvers; no custom Solidity
- **Media & Assets**: Local Hyperframes rendering, SVG vector icons

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm / yarn / pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/rikokurnia/verdict.eth.git
cd verdict.eth

# Install dependencies
npm install
```

### Running Locally

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

```bash
# Run policy engine test suite
npm test

# Type check
npm run typecheck

# Resolve the evidence graph through an independent CLI
npm run verify:ens
```

### AI audit worker

Set `SEPOLIA_RPC_URL` and `GEMINI_API_KEY` in `.env.local`. Signing keys are
encrypted files under the ignored `.secrets/` directory and are never loaded by
the Next.js backend.

```bash
# Analyze the local fictional evidence without writing
npm run audit:ai

# Analyze, validate, and write only the allowed ENSv2 records
npm run audit:ai:write

# Idempotently verify exact roles and unauthorized-write reverts
npm run configure:ens-permissions
```

The included evidence is explicitly fictional Sepolia demo data. The model
cannot choose a wallet, resolver, ENS name, or record key, and confidence is
capped at 95.

---

## 📄 License

MIT
