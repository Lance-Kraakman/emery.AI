import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAgent } from "@/app/actions/agents";
import { CanvasBase } from "@/components/canvas";
import { AgentDetailsWrapper } from "../components/AgentDetailsWrapper";
import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";

// AIDEV-NOTE: Agent detail page - renders NewAgentDetailsView with configuration cards
// Shows Basic Information, Schedule Configuration, Authorized Connections, Activity, and Skills

interface AgentPageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { agentId } = await params;
  const parsedAgentId = parseInt(agentId, 10);

  if (isNaN(parsedAgentId)) {
    redirect("/agents");
  }

  const agent = await getAgent(parsedAgentId);

  if (!agent) {
    redirect("/agents");
  }

  return (
    <CanvasBase>
      <Suspense fallback={<Loading text="Loading agent..." />}>
        <AgentDetailsWrapper agent={agent} />
      </Suspense>
    </CanvasBase>
  );
}
