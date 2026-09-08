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
           ├── Attestation Records (Audit Hash, Expiry) -> audit-001.auditor.eth
           └── Real-time Signals (Heartbeat, Health) -> Risk monitor
```

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
- **Smart Contracts**: Solidity, Foundry
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
```

---

## 📄 License

MIT
