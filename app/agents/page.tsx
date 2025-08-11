import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import AgentDashboardClient from './components/AgentDashboardClient';

export default async function AgentsPage() {
  // Fetch initial data on the server
  const [agents, teams] = await Promise.all([
    getAgents(),
    getTeams(),
  ]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Agent's</h1>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <AgentDashboardClient initialAgents={agents} teams={teams} />
      </Suspense>
    </div>
  );
}
