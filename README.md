# Verdict (`verdict.eth`)

> **Institutional Verification Registry & Autonomous Multi-Agent Consensus Layer for Real World Assets (RWAs), powered natively by ENSv2.**

[![Live App](https://img.shields.io/badge/Live%20App-verdict--eth.vercel.app-0052FF?style=flat&logo=vercel)](https://verdict-eth.vercel.app/)
[![ENSv2 Hackathon](https://img.shields.io/badge/ENSv2-Sepolia%20Deployment-5298FF?style=flat&logo=ethereum)](https://hackathon-deployment-portal-app.ens-cf.workers.dev/buidl.rwa.verdict.eth)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tests Passing](https://img.shields.io/badge/Tests-25%20Passing-brightgreen?style=flat)](https://github.com/rikokurnia/verdict.eth)

---

## 📌 Executive Summary

Over **$13B in Real World Assets (RWAs)** are currently tokenized on public blockchains—led by institutions like BlackRock (BUIDL), Ondo (USDY), and Hashnote (USYC). Yet, when DeFi protocols or autonomous agents interact with these contracts, they encounter a critical trust dilemma:
- **Opaque Contract Addresses**: Raw 40-character hexadecimal strings (`0x...`) provide zero visibility into legal standing, reserve backing, or audit freshness.
- **Unverified Web2 Disclosures**: Legal opinions, bank statements, and reserve ratios remain trapped in static issuer PDFs.
- **Zero Authority Separation**: If an issuer controls the website, they have unilateral power to claim an asset is backed, with no cryptographic separation between issuer claims and auditor attestations.

**Verdict (`verdict.eth`)** implements the official **ENS Labs thesis: *"ENS as a Registry for Tokenized Assets"***, replacing blind trust with canonical, machine-readable asset profiles, autonomous multi-agent consensus scoring, and cryptographic authority separation via **ENSv2 Enhanced Access Control (EAC)**.

---

## ⚡ Key Features

### 1. Canonical Named Asset Profiles (`*.rwa.verdict.eth`)
Replaces fragmented contract addresses with unified, human-readable ENSv2 profiles for 20 major RWA assets:
- **BUIDL**: `buidl.rwa.verdict.eth` (BlackRock USD Institutional Digital Liquidity Fund)
- **USDY**: `usdy.rwa.verdict.eth` (Ondo US Dollar Yield)
- **USYC**: `usyc.rwa.verdict.eth` (Hashnote US Yield Coin)
- **PAXG**: `paxg.rwa.verdict.eth` (Paxos Gold)

Each profile aggregates multi-chain contract addresses, SPV legal entities, custodian bank attestations, and live audit scores under standard ENS text records and contenthashes.

### 2. Autonomous 4-Agent Inspection Quartet
A specialized multi-agent fleet executes parallel off-chain analysis across three distinct audit vectors, synthesized into an on-chain risk matrix:
- 🛰️ **01 / Legal & Compliance Agent (`legal.agent.verdict.eth` — 30% weight)**: Audits SPV entity structure, prospectus disclosures, sanctions compliance, and investor eligibility.
- ✈️ **02 / Custody & Backing Agent (`custody.agent.verdict.eth` — 40% weight)**: Inspects treasury multi-sig wallets (Safe), reserve ratios, bank solvency proofs, and bankruptcy-remoteness.
- 🛸 **03 / Smart Contract Technical Agent (`technical.agent.verdict.eth` — 30% weight)**: Analyzes decompiled bytecode on Sepolia/Etherscan, admin timelocks, blacklist/freeze functions, and oracle dependencies.
- 🌐 **04 / Consensus Synthesizer Core (`consensus.agent.verdict.eth`)**: Aggregates the three inspector reports, computes the weighted mean integer score (0–100), and assigns the deterministic risk verdict.

### 3. Numerical Scoring & Deterministic Risk Verdicts
Off-chain evidence is synthesized into clear numerical scores (0–100) and mapped to 4 discrete status states:
- **`VERIFIED` (Low Risk)**: All legal, custody, and technical gates satisfied.
- **`REVIEW` (Moderate Risk)**: Attestation approaching expiration or minor documentation gap.
- **`BLOCKED` (High Risk)**: Reserves unverified, license lapse, or admin security vulnerability.
- **`UNAUDITED`**: Telemetry missing or pending initial inspection.

### 4. Two Operational Modes: Default vs Custom Lens
- **Default Mode (Official Fleet)**: Runs the canonical trio (Legal 30%, Custody 40%, Technical 30%) synthesized directly into the standard consensus score.
- **Custom Mode (Agent Factory)**: Users connect their Web3 wallet to mint their own sovereign auditor subname (e.g. `alpha-auditor.verdict.eth`) directly on ENSv2. The custom agent plugs into the Agent Quartet as a **Custom Lens**, applying the user's bespoke mandate to co-sign the final consensus verdict.

### 5. Cryptographic Separation of Authority (ENSv2 EAC)
Verdict guarantees mathematical immunity against issuer self-certification:
- Issuers maintain reference profiles at `<asset>.rwa.verdict.eth`.
- Independent auditors write exclusively to dedicated resolver contracts (`<asset>.verdict-auditor.eth`).
- Auditor worker wallets hold strict, scoped **`grantSetterRoles`** only for specific attestation keys (`audit.score`, `documentHash`, `expiresAt`) with zero root write permissions.
- **An asset issuer cannot overwrite or forge an auditor's score; any unauthorized write transaction automatically reverts on-chain.**

---

## 🏛️ Architecture & Hierarchy

```
                                  verdict.eth (Root Registry)
                                               │
       ┌───────────────────────────────────────┼───────────────────────────────────────┐
       ▼                                       ▼                                       ▼
*.rwa.verdict.eth                       *.agent.verdict.eth                    <custom>.verdict.eth
[Canonical Asset Profiles]             [Autonomous Inspector Fleet]           [Sovereign Agent Factory]
  ├── buidl.rwa.verdict.eth              ├── legal.agent.verdict.eth            ├── alpha.verdict.eth
  ├── usdy.rwa.verdict.eth               ├── custody.agent.verdict.eth          └── ... (User-Minted)
  ├── usyc.rwa.verdict.eth               ├── technical.agent.verdict.eth                 │
  └── paxg.rwa.verdict.eth               └── consensus.agent.verdict.eth                 │
                                                       │                                 │
                                                       └───────────────┬─────────────────┘
                                                                       ▼
                                                         Consensus Synthesizer Core
                                                           (Composite 0-100 Score)
```

---

## 🌟 Real-World User Impact

| Stakeholder | Concrete Value & Impact |
| :--- | :--- |
| **DeFi Protocols** *(Aave, Morpho, Sky)* | Automate collateral onboarding and risk parameters by reading `verdict.status` directly from the ENS resolver before accepting RWA collateral. |
| **RWA Issuers** *(Ondo, Backed, RealT)* | Establish institutional trust by providing continuous, tamper-proof proof of reserves and legal compliance on-chain. |
| **Autonomous AI Agents & DAOs** | Access a standardized, machine-readable truth layer to safely allocate treasury capital without relying on unparsable PDFs. |
| **Institutional Investors** | Monitor live health, reserve ratios, and attestation expiration countdowns via an interactive terminal. |

---

## 🔗 Live On-Chain Proofs (ENSv2 Sepolia Explorer)

Verdict is deployed on the official ETHOnline ENSv2 Sepolia deployment. Inspect the live names, resolvers, and role permissions directly:

- 🏛️ **Canonical BUIDL Profile**: [`buidl.rwa.verdict.eth`](https://hackathon-deployment-portal-app.ens-cf.workers.dev/buidl.rwa.verdict.eth)
- 📝 **Live Records**: [`buidl.rwa.verdict.eth/records`](https://hackathon-deployment-portal-app.ens-cf.workers.dev/buidl.rwa.verdict.eth/records)
- 🔐 **Auditor Permissioned Resolver EAC Roles**: [`Resolver 0x1C6e.../roles`](https://hackathon-deployment-portal-app.ens-cf.workers.dev/resolver/0x1C6e26A8f56C8B6C9286Fe217851c1FC9e7dA6e6/roles)
- 🛡️ **Monitor Permissioned Resolver EAC Roles**: [`Resolver 0x6592.../roles`](https://hackathon-deployment-portal-app.ens-cf.workers.dev/resolver/0x6592566d7185bbf811D2508683e4a545297A7C13/roles)
- 🌐 **Sepolia Universal Resolver Proxy**: `0xd26f2040d083af1cd2962ba303f4bea0c4faf142`

---

## 🛠️ Tech Stack

- **Frontend & App Shell**: [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Agent Canvas & Motion**: [@xyflow/react](https://reactflow.dev/) (React Flow v12), [Framer Motion](https://motion.dev/), [GSAP](https://gsap.com/)
- **Styling**: Vanilla CSS Modules with cosmic space-cadet design tokens, Archivo & Inter Variable typography
- **Web3 & ENS Resolution**: [Viem](https://viem.sh/), [Wagmi](https://wagmi.sh/), [@privy-io/react-auth](https://www.privy.io/)
- **Smart Contracts & ENS Protocol**: [ENSv2](https://docs.ens.domains/ensv2) (Hierarchical Registry, Enhanced Access Control, Permissioned Resolvers)
- **AI Agent Intelligence**: Google Gemini API (`gemini-2.5-flash`), DeepSeek, MuseSpark
- **Testing**: Native Node.js test runner with strip-types support

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js (v20 or higher recommended, minimum v18)
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
# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification & Testing
```bash
# Run the 25-suite unit test suite
npm test

# Run TypeScript typecheck
npm run typecheck

# Verify live ENS resolution through independent CLI
npm run verify:ens

# Verify all 20 RWA authority permissions
npm run verify:rwa-permissions
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env.local`:

```bash
# Required for ENSv2 on-chain resolution
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"

# Required for Web3 wallet connection
NEXT_PUBLIC_PRIVY_APP_ID="your_privy_app_id"

# AI Inference (at least one required for live agent runs)
GEMINI_API_KEY="your_gemini_api_key"

# Optional: Sponsored Custom Agent Minting Relayer
VERDICT_SPONSORED_MINT_ENABLED=true
VERDICT_RELAYER_PRIVATE_KEY="0x..."
```

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built with ❤️ for **ETHOnline 2026**.
