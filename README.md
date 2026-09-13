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

### ENSv2 Explorer proof

Verdict uses the dedicated ETHOnline ENSv2 deployment on Ethereum Sepolia. The
hackathon ENS Explorer shows ENS semantics such as the hierarchy, records,
resolver, ownership, EAC roles, and name history. Blockscout shows the underlying
Sepolia transactions and contracts.

- [Canonical asset](https://hackathon-deployment-portal-app.ens-cf.workers.dev/usd-yield-001.acme.verdict.eth)
- [Asset records](https://hackathon-deployment-portal-app.ens-cf.workers.dev/usd-yield-001.acme.verdict.eth/records)
- [Asset registry hierarchy](https://hackathon-deployment-portal-app.ens-cf.workers.dev/usd-yield-001.acme.verdict.eth/registry)
- [Auditor resolver EAC roles](https://hackathon-deployment-portal-app.ens-cf.workers.dev/resolver/0x1C6e26A8f56C8B6C9286Fe217851c1FC9e7dA6e6/roles)
- [Verdict resolution debug page](http://localhost:3000/debug)

The app and CLI resolve through the hackathon Universal Resolver proxy at
`0xd26f2040d083af1cd2962ba303f4bea0c4faf142`, not the resolver bundled into
standard ethers or viem Sepolia configuration.

### Vercel environment

Copy the relevant keys from `.env.example` into Vercel Project Settings →
Environment Variables. Apply them to Production and Preview, then redeploy:

- `SEPOLIA_RPC_URL` — required server-side Sepolia RPC endpoint.
- `NEXT_PUBLIC_PRIVY_APP_ID` — required public Privy application ID. Add every
  deployed Vercel domain to the Privy app's allowed domains.
- At least one of `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, or
  `MUSESPARK_API_KEY` — required for live agent inspections.
- `AI_PROVIDERS` and the provider-specific `*_MODEL` variables are optional.

Do not commit `.env.local`, `.secrets/`, passwords, or private keys. The default
Vercel deployment runs ENS reads and inspect-only AI flows without signing custody.
To enable the sponsored Custom Auditor Factory, add these **server-only** Vercel
secrets (never prefix them with `NEXT_PUBLIC_`):

- `VERDICT_SPONSORED_MINT_ENABLED=true`
- `VERDICT_RELAYER_KEYSTORE_JSON` — complete encrypted JSON from the authorized
  Sepolia namespace wallet (`.secrets/verdict-sepolia-agent` locally).
- `VERDICT_RELAYER_KEYSTORE_PASSWORD` — that keystore's password.

The relayer needs Sepolia ETH and permission to register names in the Verdict
registry and write their resolver records. Use a Sepolia-only funded relayer,
not a mainnet wallet. Together, the keystore and password grant signing custody
to the server, so protect Vercel access and limit the relayer's permissions/funds.
Users authorize their exact name and policy with a wallet signature; the server
registers the ENS branch and publishes its policy, then returns transaction and
Explorer proof. Onchain bulk score refresh remains disabled on Vercel. Runtime
receipts use temporary storage and may disappear when a function is recycled.

### AI audit worker

Set `SEPOLIA_RPC_URL` and `GEMINI_API_KEY` in `.env.local`. Signing keys are
encrypted files under the ignored `.secrets/` directory. The sponsored factory
backend loads only its configured namespace relayer for registration.

```bash
# Analyze the local fictional evidence without writing
npm run audit:ai

# Analyze, validate, and write only the allowed ENSv2 records
npm run audit:ai:write

# Read-only plan: names, owners, signer balances and gas budgets
npm run plan:rwa-evidence

# Read-only checks for all 20 canonical assets (no signing keys loaded)
npm run verify:rwa-permissions
```

The included evidence is explicitly fictional Sepolia demo data. The model
cannot choose a wallet, resolver, ENS name, or record key, and confidence is
capped at 95.

### Evidence authority model and migration

The 40 evidence names and subject/schema bindings are now registered on Sepolia.
All 20 assets passed the permission checks at blocks 11694440–11694447.
The public historical receipt is `public/data/ens-authority-setup.json`, including
all 44 confirmed transaction hashes and actual total gas fees of
0.00850653019692695 Sepolia ETH. This setup does not publish new evaluation
attestations or prove real reserves. Re-run live checks because the hackathon
deployment can reset and administrators can change authority.

Issuer/reference profiles stay at `<asset>.rwa.verdict.eth`. Each of the 20 RWA
profiles has deterministic evidence authorities:

| Writer | Evidence name | Enforced record scope |
| --- | --- | --- |
| Auditor worker `0xeABF723A3a2985aEB61D5853BfFF7eb8e83e6232` | `<asset>.verdict-auditor.eth` | Eight exact `verdict.attestation.*` keys on the auditor resolver |
| Sentinel worker `0x18834e33Cc3164D9b21828A1aB4e40533DF22401` | `<asset>.verdict-monitor.eth` | Eight exact `verdict.observation.*` keys on the monitor resolver |
| Namespace relayer | `<asset>.rwa.verdict.eth` | Issuer profile and single-relayer `verdict.quartet.*` convenience summary |

The existing fictional demo remains linked to `audit-001.verdict-auditor.eth`
and `risk-001.verdict-monitor.eth`. `legal.agent.verdict.eth` and the other
quartet names are discovery identities, **not independent signer proofs**.
AI inference runs offchain. Separate worker keys enforce resolver-level access
boundaries; they are currently all operated by the Verdict team, not external
auditors. These demonstration attestations are not audits commissioned by the
real asset issuers and do not prove their reserves.

Grants are **text-key scoped across names using each dedicated resolver**,
not name-and-key scoped. The namespace operator cannot write those protected
keys on the dedicated resolvers, but it can change pointers and summaries in
its own issuer profiles. Recovery admins can delegate roles and upgrade the
dedicated resolvers; registry and `.eth` owners can redirect resolution. The
app derives the expected evidence names and checks their resolver and subject
binding, rather than accepting an issuer-selected evidence pointer as proof.

For a fresh deployment, the 40 evidence names require a reviewed Sepolia registration step. Code
deployment alone does not register them. The default setup command is read-only
and prints public signer addresses, funding and conservative budgets. After
reviewing the plan and explicitly authorizing local encrypted-keystore signing:

```bash
npm run plan:rwa-evidence -- --apply --allow-keystore-signing
```

This registers missing names under the separate existing authority registries,
owned by the respective recovery admin with zero initial name roles. It grants
the admin only the additional subject/schema text keys and publishes bindings;
it does not fabricate audit results or transfer funds. Unexpected existing
owners and failed worker isolation checks abort setup. After registration,
run the local curator score refresh to publish new protected records. Historical
single-relayer summaries are not retroactively independent attestations.

In Overview → Inspect → Identifier → ENSv2 Explorer proof, open each authority's
**Resolver roles**, or click **Verify live permissions**. The read-only endpoint
`/api/ens/permissions?name=buidl.rwa.verdict.eth` returns a pinned Sepolia block,
active registration/owner and subject/resolver binding, allowed-key checks, denied issuer/cross-worker writes,
denied worker delegation and administrative recovery verification. Incomplete
setup is explicitly not verified; RPC outages are unavailable, never a pass.
No additional Vercel signing credentials are needed: `SEPOLIA_RPC_URL` supports
these reads. Evidence writes and bulk refresh remain disabled on Vercel.

`configure:ens-permissions` is a role-changing legacy setup command, not a
read-only verifier. It now requires `--apply`; do not run it to check the UI.

#### CROPS trust record

Chosen default: separate existing authority roots/resolvers, narrow evidence
workers and public, signer-free permission checks. Vercel, AI providers and the
team-operated writers can still block fresh publications. Existing ENS records
remain directly readable through another Sepolia RPC/ENS Explorer, and the
source, ABIs and setup commands are available for self-hosting under MIT.
Wallet addresses, record values and transaction timing are public; no wallet
connection is required for permission checks. Recovery and registry control
remain accepted hackathon compromises, not decentralization or third-party
auditor independence. Production should use separately controlled institutions
and multisig/timelocked administrative recovery.

---

## 📄 License

MIT
