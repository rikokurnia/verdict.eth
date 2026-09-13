"use client";

import { PageHead } from "@/components/app/app-shell";
import AgentFactory from "@/components/app/agent-factory";
import AgentQuartet from "@/components/app/agent-quartet";

export default function AgentsPage() {
  return (
    <>
      <PageHead
        title="Agents"
        sub="Commission your auditor. Watch specialized offchain agents turn evidence into an onchain decision."
      />

      <AgentFactory
        onMinted={(subname) => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("verdict:auditor-minted", { detail: subname }),
            );
          }
        }}
      />
      <AgentQuartet />
    </>
  );
}
