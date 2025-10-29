import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAgent } from "@/app/actions/agents";
import { Bot } from "lucide-react";
import { BasePage } from "@/components/canvas";
import AgentDetailsView from "../components/AgentDetailsView";
import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";

// AIDEV-NOTE: Agent detail page - renders individual agent view
// Created to fix 404 errors when navigating from sidebar

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
    <BasePage
      title={agent.name}
      subtitle={agent.role || "Agent"}
      icon={<Bot className="h-5 w-5" />}
    >
      <Suspense fallback={<Loading text="Loading agent..." />}>
        <AgentDetailsView agent={agent} />
      </Suspense>
    </BasePage>
  );
}
