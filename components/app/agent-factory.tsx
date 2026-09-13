"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ShieldCheck, Wallet } from "lucide-react";
import { useWallets } from "@privy-io/react-auth";
import { useWallet } from "@/components/wallet-context";
import { signAgentDeployment } from "@/lib/agent-wallet-signing";
import { selfDeployAuditorBranch, type SelfDeployPhase } from "@/lib/agent-self-deploy";
import { AUDITOR_BRANCH_BITMAP, AUDITOR_BRANCH_ROLES } from "@/lib/auditor-branch-policy";
import type { ToastKind } from "@/components/app/toast";
import { AgentIdentityProof } from "@/components/app/agent-identity-proof";
import Image from "next/image";
import s from "./agent-orchestra.module.css";
import { ENS_EXPLORER_NAME_URL } from "@/lib/ensv2-config";
import { loadDeployments, rememberCustomAgent, rememberDeployment, type DeploymentRecord } from '@/lib/custom-agent-store';

const ETHERSCAN_TX = "https://eth-sepolia.blockscout.com/tx";

const PRESETS = [
  {
    label: "Zero proxy / blacklist tolerance",
    text: "Downgrade any asset whose token contract is an upgradeable proxy, has blacklist/freeze powers, or is administered by a single EOA: cap technical score at 40 and force WARN or FAIL. Immutability and distributed control outrank all other signals.",
  },
  {
    label: "Physical collateral only",
    text: "Approve only assets backed by allocated physical collateral (e.g. vaulted gold) or short-term government securities with a named custodian. Cap custody score at 50 when the custodian, attestation auditor, or SPV structure is unknown. Synthetic or algorithmic backing must FAIL.",
  },
];

type MintConfirmation = {
  subname: string;
  owner: string;
  roles: string;
  roleBitmap: string;
  transactions: {
    register: { hash: string; blockNumber: number };
    records: { hash: string; blockNumber: number };
  };
  policy: string;
  context: string;
};

function shortHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export default function AgentFactory({
  onMinted,
  onNotify,
}: {
  onMinted?: (subname: string) => void;
  onNotify?: (kind: ToastKind, title: string, body: string) => void;
}) {
  const { account, isConnected, connect } = useWallet();
  const { wallets } = useWallets();
  const [label, setLabel] = useState("");
  const [policy, setPolicy] = useState(PRESETS[0].text);
  const [availability, setAvailability] = useState<{
    state: "idle" | "checking" | "free" | "taken" | "invalid" | "unavailable";
    owner?: string;
  }>({ state: "idle" });
  const [deploying, setDeploying] = useState(false);
  const [deploymentEnabled, setDeploymentEnabled] = useState(true);
  const [deployPhase, setDeployPhase] = useState("Confirm in wallet…");
  const [deployMode, setDeployMode] = useState<'sponsored' | 'self-pay'>('sponsored');
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const deployLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<MintConfirmation | null>(
    null,
  );
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const availabilityVersion = useRef(0);

  const clean = label.trim().toLowerCase();
  const labelValid =
    /^[a-z0-9-]{1,32}$/.test(clean) &&
    !clean.startsWith("-") &&
    !clean.endsWith("-");

  const checkAvailability = useCallback(async (value: string) => {
    const version = ++availabilityVersion.current;
    if (
      !/^[a-z0-9-]{1,32}$/.test(value) ||
      value.startsWith("-") ||
      value.endsWith("-")
    ) {
      setAvailability({ state: value ? "invalid" : "idle" });
      return;
    }
    setAvailability({ state: "checking" });
    try {
      const response = await fetch(
        `/api/agents/mint?label=${encodeURIComponent(value)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as { ok: boolean; available: boolean; owner?: string; deploymentEnabled?: boolean };
      if (version !== availabilityVersion.current) return;
      if (!response.ok || !body.ok) {
        setAvailability({ state: "unavailable" });
        return;
      }
      setDeploymentEnabled(body.deploymentEnabled !== false);
      setAvailability(body.available ? { state: "free" } : { state: "taken", owner: body.owner });
    } catch {
      if (version === availabilityVersion.current)
        setAvailability({ state: "unavailable" });
    }
  }, []);

  useEffect(() => {
    availabilityVersion.current += 1;
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!clean) {
      setAvailability({ state: "idle" });
      return;
    }
    setAvailability({ state: "checking" });
    checkTimer.current = setTimeout(() => void checkAvailability(clean), 500);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [clean, checkAvailability]);

  useEffect(() => {
    try {
      setDeployments(loadDeployments());
    } catch {
      // Private mode: this page session still works, list just won't persist.
    }
  }, []);

  function finishMint(mint: MintConfirmation, mode: 'sponsored' | 'self-pay') {
    setConfirmation(mint);
    try {
      setDeployments(rememberDeployment({
        subname: mint.subname,
        owner: mint.owner,
        register: mint.transactions.register,
        records: mint.transactions.records,
        mode,
      }));
    } catch {
      rememberCustomAgent(mint.subname);
    }
    onMinted?.(mint.subname);
    onNotify?.(
      'pass',
      mode === 'sponsored' ? 'Agent deployed · gas sponsored' : 'Agent deployed · self-paid',
      `${mint.subname} is live on ENS. Select it below in Custom lens to run the quartet through your rules.`,
    );
    void checkAvailability(clean);
  }

  function sponsoredUnavailable(error: unknown, status?: number) {
    if (status === 503 || status === 429) return true;
    const message = error instanceof Error ? error.message : String(error ?? '');
    return /sponsor|relayer|keystore|decrypt|not configured|operator must enable/i.test(message);
  }

  async function deploySelfPay(
    wallet: { getEthereumProvider: () => Promise<unknown> },
    owner: string,
    cleanPolicy: string,
  ) {
    setDeployMode('self-pay');
    const phases: Record<SelfDeployPhase, string> = {
      'checking-wallet': 'Checking wallet & Sepolia ETH…',
      'switching-network': 'Requesting Sepolia network in wallet…',
      registering: 'Confirm registration in wallet…',
      'publishing-policy': 'Confirm policy publish in wallet…',
      confirming: 'Reading back onchain proof…',
    };
    const result = await selfDeployAuditorBranch(
      (await wallet.getEthereumProvider()) as never,
      clean,
      owner,
      cleanPolicy,
      (phase) => setDeployPhase(phases[phase]),
    );
    // Read back the live branch as mint proof (public records, short poll).
    let proof: { owner: string; policy: string; context: string } | null = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await fetch(`/api/agents/custom?name=${encodeURIComponent(result.subname)}`, { cache: 'no-store' });
        const body = (await response.json()) as { ok: boolean; agent?: { owner: string; policy: string; context: string } };
        if (response.ok && body.ok && body.agent
          && body.agent.owner.toLowerCase() === owner.toLowerCase()
          && body.agent.policy === cleanPolicy) {
          proof = body.agent;
          break;
        }
      } catch {
        // Indexer/RPC lag — retry.
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!proof) {
      throw new Error(
        `Transactions confirmed (${result.register.hash.slice(0, 10)}…, ${result.records.hash.slice(0, 10)}…) but the live read-back is lagging. Your agent exists — retry verification from Custom lens in a minute.`,
      );
    }
    finishMint({
      subname: result.subname,
      owner,
      roles: AUDITOR_BRANCH_ROLES,
      roleBitmap: `0x${AUDITOR_BRANCH_BITMAP.toString(16)}`,
      transactions: { register: result.register, records: result.records },
      policy: proof.policy,
      context: proof.context,
    }, 'self-pay');
  }

  async function deploy() {
    if (deployLock.current) return;
    setError(null);
    setConfirmation(null);
    if (!labelValid || policy.trim().length < 20) {
      setError("Enter a valid subname and a policy of at least 20 characters.");
      return;
    }
    const wallet = wallets.find((w) => w.address.toLowerCase() === account.toLowerCase());
    if (!isConnected || !wallet) {
      try {
        connect();
      } catch {
        /* connect opens the wallet dialog */
      }
      setError(
        "Connect an Ethereum wallet and wait for it to become ready, then deploy again.",
      );
      return;
    }
    deployLock.current = true;
    setDeploying(true);
    setDeployMode('sponsored');
    setDeployPhase("Confirm in wallet…");
    try {
      const cleanPolicy = policy.trim();
      const owner = wallet.address;
      // Self-pay first when the sponsored relayer is known to be off.
      if (!deploymentEnabled) {
        await deploySelfPay(wallet, owner, cleanPolicy);
        return;
      }
      const { message, signature } = await signAgentDeployment(
        await wallet.getEthereumProvider(), wallet.address, clean, cleanPolicy,
      );
      setDeployPhase("Registering ENS agent…");
      const response = await fetch("/api/agents/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: clean,
          policy: cleanPolicy,
          address: owner,
          message,
          signature,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        mint?: MintConfirmation;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.mint) {
        const failure = new Error(body.error ?? "Mint failed");
        // Sponsored path down (e.g. broken relayer keystore on a hosted
        // deployment) — fall back to the user's own wallet paying gas.
        if (sponsoredUnavailable(failure, response.status)) {
          onNotify?.('info', 'Sponsored relayer unavailable', 'Trying the direct wallet path…');
          await deploySelfPay(wallet, owner, cleanPolicy);
          return;
        }
        throw failure;
      }
      setDeployMode('sponsored');
      finishMint(body.mint, 'sponsored');
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      setError(message);
      onNotify?.('blocked', 'Agent deployment failed', message);
    } finally {
      deployLock.current = false;
      setDeploying(false);
    }
  }

  return (
    <section className={s.factory}>
      <aside className={s.factoryVisual} aria-label="Custom auditor flagship">
        <span className={s.kicker}>COMMANDER / CUSTOM AUTHORITY</span>
        <Image
          src="/assets/agent-assets/plane1.png"
          alt="Custom auditor command starship"
          width={400}
          height={300}
          className={s.factoryShip}
          priority
        />
        <div>
          <h3>
            Your rules.
            <br />
            Your authority.
          </h3>
          <p>
            Give your investment thesis an onchain identity. The fleet inspects
            through your lens.
          </p>
          <small>ENSv2 · SPONSORED OR SELF-PAID</small>
        </div>
      </aside>
      <div className={s.factoryForm}>
        <div className="v-card-header">
          <div>
            <div className="v-card-tag">02 / CUSTOM AUDITOR FACTORY</div>
            <h3 className="v-section-title">Mint your own auditor branch</h3>
            <p className="v-muted">
              Claim <span className="v-mono">[name].verdict.eth</span> with your
              wallet as owner, publish your audit policy onchain, then run the
              quartet through your lens. Sponsored (gasless) when the relayer
              is configured — otherwise your wallet pays Sepolia gas for the
              same two onchain steps.
            </p>
          </div>
        </div>

        {!isConnected && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              marginBottom: 16,
              borderRadius: 8,
              background: "rgba(37, 99, 235, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#bfdbfe",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={16} style={{ color: "#60a5fa", flexShrink: 0 }} />
              <span>
                <strong>Wallet required for customization:</strong> Connect your Web3 wallet to claim an ENSv2 subname and sign your custom audit policy.
              </span>
            </div>
            <button
              type="button"
              className="v-btn v-btn-secondary"
              onClick={() => connect()}
              style={{ padding: "4px 12px", fontSize: 12, height: "auto", flexShrink: 0 }}
            >
              Connect Wallet
            </button>
          </div>
        )}

        <div className="v-table-toolbar" style={{ alignItems: "stretch" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="v-label" htmlFor="factory-subname">
              Subname
            </label>
            <div className="v-table-search-box" style={{ marginTop: 6 }}>
              <input
                id="factory-subname"
                className="v-search-input"
                style={{ fontFamily: "var(--font-mono)" }}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="zero-risk"
                value={label}
                onChange={(event) => setLabel(event.target.value.toLowerCase())}
                disabled={deploying}
                aria-describedby="factory-subname-status"
              />
              <span className="v-cell-sub" style={{ paddingRight: 12 }}>
                .verdict.eth
              </span>
            </div>
            <div
              id="factory-subname-status"
              className="v-cell-sub"
              style={{ marginTop: 6 }}
              role="status"
              aria-live="polite"
            >
              {availability.state === "checking" && "Checking registry…"}
              {availability.state === "free" && (
                <span className="v-pass-t">
                  ✓ Available — {clean}.verdict.eth
                </span>
              )}
              {availability.state === "taken" && (
                <span className="v-block-t">
                  × Taken
                  {availability.owner
                    ? ` by ${shortHash(availability.owner)}`
                    : ""}
                </span>
              )}
              {availability.state === "invalid" &&
                clean &&
                "Lowercase letters, digits, hyphens; no leading/trailing hyphen."}
              {availability.state === "unavailable" && (
                <span>
                  Registry unavailable.{" "}
                  <button
                    type="button"
                    className="v-btn v-btn-secondary"
                    onClick={() => void checkAvailability(clean)}
                  >
                    Retry check
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="v-label" htmlFor="factory-policy">
            Custom audit rules / system prompt
          </label>
          <div
            style={{
              display: "flex",
              gap: 8,
              margin: "8px 0",
              flexWrap: "wrap",
            }}
          >
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className="v-btn v-btn-secondary"
                disabled={deploying}
                onClick={() => setPolicy(preset.text)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <textarea
            id="factory-policy"
            className="v-search-input"
            style={{
              width: "100%",
              minHeight: 110,
              padding: 12,
              fontSize: 13,
              lineHeight: 1.6,
              resize: "vertical",
            }}
            value={policy}
            maxLength={2000}
            onChange={(event) => setPolicy(event.target.value)}
            disabled={deploying}
          />
          <div className="v-cell-sub" style={{ marginTop: 4 }}>
            {policy.length}/2000 · stored onchain in agent.policy · applied as
            Mode B lens
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {!isConnected ? (
            <button
              type="button"
              className="v-btn"
              onClick={() => connect()}
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                boxShadow: "0 0 16px rgba(37, 99, 235, 0.35)",
                cursor: "pointer",
              }}
            >
              <Wallet
                size={14}
                aria-hidden="true"
                style={{ marginRight: 6 }}
              />
              Connect Wallet to Deploy Agent
            </button>
          ) : (
            <button
              type="button"
              className="v-btn"
              onClick={() => void deploy()}
              disabled={
                deploying ||
                !labelValid ||
                policy.trim().length < 20 ||
                availability.state !== "free"
              }
              aria-busy={deploying}
            >
              {deploying ? (
                <span className={s.deployingPulse}>{deployPhase}</span>
              ) : (
                <>
                  <Wallet
                    size={14}
                    aria-hidden="true"
                    style={{ marginRight: 6 }}
                  />
                  {!deploymentEnabled ? "Deploy agent · you pay gas" : "Deploy agent"}
                </>
              )}
            </button>
          )}
          {isConnected ? (
            <span className="v-cell-sub v-mono">{shortHash(account)}</span>
          ) : (
            <span
              className="v-cell-sub"
              style={{
                color: "#93c5fd",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <ShieldCheck size={14} style={{ color: "#60a5fa" }} />
              Wallet required to sign and register your custom agent on ENSv2
            </span>
          )}
        </div>
        {!deploymentEnabled && (
          <p className="v-cell-sub" role="status" style={{ marginTop: 8 }}>
            Sponsored (gasless) deployment is off on this server — deploying
            with your wallet instead. You pay Sepolia gas; the onchain result
            is identical.
          </p>
        )}
        {error && (
          <p className="v-block-t" role="alert" style={{ marginTop: 8 }}>
            {error}
          </p>
        )}

        {deployments.length > 0 && (
          <div
            className="v-verification-panel"
            style={{ marginTop: 14 }}
            aria-live="polite"
            aria-label="Your deployed agents in this browser"
          >
            <div>
              <div className="v-label">Your agents · this browser only</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                {deployments.map((d) => (
                  <div key={d.subname}>
                    <AgentIdentityProof
                      subname={d.subname}
                      owner={d.owner}
                      registerTx={d.register}
                      recordsTx={d.records}
                      compact
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <span className="v-cell-sub">
                        {d.mode === 'sponsored' ? 'gas sponsored' : 'self-paid'} · {new Date(d.deployedAt).toLocaleString()}
                      </span>
                      <button
                        type="button"
                        className="v-btn v-btn-secondary"
                        style={{ padding: '4px 12px', fontSize: 12, height: 'auto' }}
                        onClick={() => onMinted?.(d.subname)}
                        title={`Run the quartet through ${d.subname}`}
                      >
                        Use as custom lens
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {confirmation && (
          <div
            className="v-verification-panel is-verified"
            style={{ marginTop: 14 }}
            aria-live="polite"
          >
            <div>
              <div className="v-label">
                Deployed · {deployMode === 'sponsored' ? 'gas sponsored' : 'self-paid'} · proof below
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 4px' }}>
                <span className={s.deploySuccess} aria-hidden="true">
                  <Check size={22} />
                </span>
                <h3 style={{ margin: 0 }}>{confirmation.subname}</h3>
              </div>
              <div style={{ margin: '10px 0' }}>
                <AgentIdentityProof
                  subname={confirmation.subname}
                  owner={confirmation.owner}
                  registerTx={confirmation.transactions.register}
                  recordsTx={confirmation.transactions.records}
                />
              </div>
              <dl className="v-kv" style={{ marginTop: 10 }}>
                <dt>Deployed subname</dt>
                <dd className="v-mono">{confirmation.subname}</dd>
                <dt>Verified owner</dt>
                <dd className="v-mono">
                  {confirmation.owner}
                  {confirmation.owner.toLowerCase() === account.toLowerCase()
                    ? " ✓ you"
                    : ""}
                </dd>
                <dt>EAC permission</dt>
                <dd className="v-mono">{confirmation.roles}</dd>
                <dt>Role bitmap</dt>
                <dd className="v-mono">{confirmation.roleBitmap}</dd>
                <dt>Register tx</dt>
                <dd className="v-mono">
                  <a
                    href={`${ETHERSCAN_TX}/${confirmation.transactions.register.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortHash(confirmation.transactions.register.hash)} ↗
                  </a>{" "}
                  · block {confirmation.transactions.register.blockNumber}
                </dd>
                <dt>Records tx</dt>
                <dd className="v-mono">
                  <a
                    href={`${ETHERSCAN_TX}/${confirmation.transactions.records.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortHash(confirmation.transactions.records.hash)} ↗
                  </a>{" "}
                  · block {confirmation.transactions.records.blockNumber}
                </dd>
                <dt>agent.policy</dt>
                <dd style={{ fontSize: 13 }}>“{confirmation.policy}”</dd>
              </dl>
              <div className="v-dialog-actions" style={{ marginTop: 10 }}>
                <a
                  className="v-btn v-btn-secondary"
                  href={ENS_EXPLORER_NAME_URL(confirmation.subname)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View ENS agent proof
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
