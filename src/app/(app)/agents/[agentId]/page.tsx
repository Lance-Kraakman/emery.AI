import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAgent } from "@/app/actions/agents";
import { CanvasBase } from "@/components/canvas/CanvasBase";
import { Suspense } from "react";
import { AgentPageClient } from "../components/AgentPageClient";
import { AgentHeaderWrapper } from "../components/AgentHeaderWrapper";
import { AgentHeaderSkeleton } from "../components/AgentHeaderSkeleton";
import { TimelineWrapper } from "../components/TimelineWrapper";
import { TimelineSkeleton } from "../components/TimelineSkeleton";

// AIDEV-NOTE: Agent detail page with React streaming for fast perceived load
// Uses Suspense boundaries to stream header and timeline independently
// Header shows immediately with agent info, then skills/connections load
// Timeline streams in separately with its own loading state

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
    redirect("/mission-control/dashboard");
  }

  // Only fetch agent initially - required for auth check and basic display
  const agent = await getAgent(parsedAgentId);

  if (!agent) {
    redirect("/mission-control/dashboard");
  }

  // Stream the page with independent Suspense boundaries
  // Header and Timeline load in parallel, showing content as it becomes available
  return (
    <CanvasBase>
      <AgentPageClient>
        {/* Header streams first - shows agent info immediately, skills/connections load async */}
        <Suspense fallback={<AgentHeaderSkeleton agent={agent} />}>
          <AgentHeaderWrapper agent={agent} />
        </Suspense>

        {/* Timeline streams separately - shows skeleton while tasks load */}
        <Suspense fallback={<TimelineSkeleton />}>
          <TimelineWrapper agentId={agent.id} schedules={agent.automations} />
        </Suspense>
      </AgentPageClient>
    </CanvasBase>
  );
}
