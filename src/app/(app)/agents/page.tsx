import React, { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { Loading } from '@/components/ui/loading';
import { auth } from '@/lib/auth';
import { AgentsPage as AgentsPageLayout } from '@/components/canvas';
import AgentDashboardClient from './components/AgentDashboardClient';

// AIDEV-NOTE: Agents page updated to use canvas architecture with collapsible layout

export default async function AgentsPage() {
  // Get current user's organization
  const session = await auth();
  const organizationId = session?.user?.currentOrganizationId;

  // Fetch initial data on the server
  const [agents, teams] = await Promise.all([
    getAgents(),
    getTeams(organizationId),
  ]);

  return (
    <AgentsPageLayout>
      <Suspense fallback={<Loading text="Loading agents..." />}>
        <AgentDashboardClient initialAgents={agents} teams={teams} />
      </Suspense>
    </AgentsPageLayout>
  );
}
