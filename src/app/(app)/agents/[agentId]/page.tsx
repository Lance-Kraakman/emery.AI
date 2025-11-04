import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAgent } from "@/app/actions/agents";
import { getTasks } from "@/app/actions/tasks";
import { getSkillsByAgent } from "@/app/actions/skills";
import { getUserOAuthConnections } from "@/app/actions/connections";
import { CanvasBase } from "@/components/canvas/CanvasBase";
import { AgentDetailsWrapper } from "../components/AgentDetailsWrapper";
import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";

// AIDEV-NOTE: Agent detail page - renders new timeline-focused layout
// Shows full-screen timeline with compact header containing agent info, skills, connections, schedules
// Uses CanvasBase for full-page layout without padding

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

  const agent = await getAgent(parsedAgentId);

  if (!agent) {
    redirect("/mission-control/dashboard");
  }

  // Fetch all data in parallel
  const [tasksResult, skillsResult, connectionsResult] = await Promise.all([
    getTasks(parsedAgentId),
    getSkillsByAgent(parsedAgentId),
    getUserOAuthConnections()
  ]);
  const tasks = tasksResult.success ? (tasksResult.data || []) : [];
  const skills = skillsResult.success ? (skillsResult.data || []) : [];
  const connections = connectionsResult.success ? (connectionsResult.data || []) : [];

  return (
    <CanvasBase>
      <Suspense fallback={<Loading text="Loading agent..." />}>
        <AgentDetailsWrapper
          agent={agent}
          tasks={tasks}
          skills={skills}
          connections={connections}
        />
      </Suspense>
    </CanvasBase>
  );
}
