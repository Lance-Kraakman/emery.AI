import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTeam } from "@/app/actions/teams";
import { getAgents } from "@/app/actions/agents";
import { CanvasBase } from "@/components/canvas";
import TeamDetailsView from "../components/TeamDetailsView";
import { Suspense } from "react";
import { Loading } from "@/components/ui/loading";

// AIDEV-NOTE: Team detail page - renders individual team view
// Uses CanvasBase for minimal wrapper with collapse functionality

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { teamId } = await params;
  const parsedTeamId = parseInt(teamId, 10);

  if (isNaN(parsedTeamId)) {
    redirect("/teams");
  }

  // Fetch team and all agents in parallel
  const [team, agents] = await Promise.all([
    getTeam(parsedTeamId),
    getAgents()
  ]);

  if (!team) {
    redirect("/teams");
  }

  return (
    <CanvasBase>
      <Suspense fallback={<Loading text="Loading team..." />}>
        <TeamDetailsView team={team} agents={agents || []} />
      </Suspense>
    </CanvasBase>
  );
}
