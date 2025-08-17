import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { Loading } from '@/components/ui/loading';
import { auth } from '@/lib/auth';
import AgentDashboardClient from './components/AgentDashboardClient';

// AIDEV-NOTE: Agents page refactored to use consistent design patterns and improved error handling

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
    <div className="h-full">
      <Suspense fallback={<Loading text="Loading dashboard..." />}>
        <AgentDashboardClient initialAgents={agents} teams={teams} />
      </Suspense>
    </div>
  );
}
