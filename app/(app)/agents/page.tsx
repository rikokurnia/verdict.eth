"use client";

import { PageHead } from "@/components/app/app-shell";
import AgentFactory from "@/components/app/agent-factory";
import AgentQuartet from "@/components/app/agent-quartet";
import { ToastStack, useToasts } from "@/components/app/toast";

export default function AgentsPage() {
  const { toasts, push } = useToasts();
  return (
    <>
      <PageHead
        title="Agents"
        sub="Commission your auditor. Watch specialized offchain agents turn evidence into an onchain decision."
      />

      <AgentFactory onNotify={push} />
      <AgentQuartet />
      <ToastStack toasts={toasts} />
    </>
  );
}
