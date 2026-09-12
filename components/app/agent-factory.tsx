"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Wallet } from "lucide-react";
import { useWallets } from "@privy-io/react-auth";
import { useWallet } from "@/components/wallet-context";
import Image from "next/image";
import s from "./agent-orchestra.module.css";
import { ENSV2_SEPOLIA } from "@/lib/ensv2-config";

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
}: {
  onMinted?: (subname: string) => void;
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
      const body = (await response.json()) as { ok: boolean; owner?: string };
      if (version !== availabilityVersion.current) return;
      if (!response.ok || !body.ok) {
        setAvailability({ state: "unavailable" });
        return;
      }
      setAvailability(
        body.owner ? { state: "taken", owner: body.owner } : { state: "free" },
      );
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

  async function deploy() {
    setError(null);
    setConfirmation(null);
    if (!labelValid || policy.trim().length < 20) {
      setError("Enter a valid subname and a policy of at least 20 characters.");
      return;
    }
    let owner = account;
    let signMessage: ((message: string) => Promise<string>) | null = null;
    if (isConnected && wallets.length > 0) {
      owner = wallets[0].address;
      const wallet = wallets[0] as unknown as {
        signMessage?: (message: string) => Promise<string | Uint8Array>;
      };
      if (typeof wallet.signMessage === "function") {
        signMessage = async (message: string) =>
          String(await wallet.signMessage!(message));
      }
    }
    if (!isConnected || !signMessage) {
      try {
        connect();
      } catch {
        /* connect opens the wallet dialog */
      }
      setError(
        "Connect a wallet first (injected wallet required for signing), then deploy again.",
      );
      return;
    }
    setDeploying(true);
    try {
      const timestamp = new Date().toISOString();
      const message = [
        `Verdict Auditor Factory — claim ${clean}.verdict.eth`,
        `Owner: ${owner}`,
        `Timestamp: ${timestamp}`,
      ].join("\n");
      const signature = await signMessage(message);
      const response = await fetch("/api/agents/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: clean,
          policy: policy.trim(),
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
      if (!response.ok || !body.ok || !body.mint)
        throw new Error(body.error ?? "Mint failed");
      setConfirmation(body.mint);
      try {
        localStorage.setItem("verdict-custom-agent", body.mint.subname);
      } catch {
        /* storage optional */
      }
      onMinted?.(body.mint.subname);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
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
          <small>ENSv2 · SPONSORED DEPLOYMENT</small>
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
              quartet through your lens. One free signature — the mint is
              sponsored, no gas needed.
            </p>
          </div>
        </div>

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
              "Deploying to ENSv2…"
            ) : (
              <>
                <Wallet
                  size={14}
                  aria-hidden="true"
                  style={{ marginRight: 6 }}
                />
                Sign & Deploy Agent to ENSv2
              </>
            )}
          </button>
          {isConnected && (
            <span className="v-cell-sub v-mono">{shortHash(account)}</span>
          )}
        </div>
        {error && (
          <p className="v-block-t" role="alert" style={{ marginTop: 8 }}>
            {error}
          </p>
        )}

        {confirmation && (
          <div
            className="v-verification-panel is-verified"
            style={{ marginTop: 14 }}
            aria-live="polite"
          >
            <div>
              <div className="v-label">Deployed · proof below</div>
              <h3>
                {confirmation.subname}{" "}
                <Check
                  size={16}
                  aria-hidden="true"
                  style={{ verticalAlign: -2 }}
                />
              </h3>
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
                  href={`${ENSV2_SEPOLIA.explorer}/address/${ENSV2_SEPOLIA.proxies.verdictRegistry}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open registry
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
