import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { Loading } from '@/components/ui/loading';
import AgentDashboardClient from './components/AgentDashboardClient';

// AIDEV-NOTE: Agents page refactored to use consistent design patterns and improved error handling
// AIDEV-NOTE: Page is dynamic due to session/organization context requirements

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  // Fetch initial data on the server
  const [agents, teams] = await Promise.all([
    getAgents(),
    getTeams(),
  ]);

  return (
    <div className="h-full">
      <Suspense fallback={<Loading text="Loading dashboard..." />}>
        <AgentDashboardClient initialAgents={agents} teams={teams} />
      </Suspense>
    </div>
  );
}
