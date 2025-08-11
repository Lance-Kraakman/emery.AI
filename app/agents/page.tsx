import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { Loading } from '@/components/ui/loading';
import AgentDashboardClient from './components/AgentDashboardClient';

// AIDEV-NOTE: Agents page refactored to use consistent design patterns and improved error handling

export default async function AgentsPage() {
  // Fetch initial data on the server
  const [agents, teams] = await Promise.all([
    getAgents(),
    getTeams(),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="text-muted-foreground">Manage your AI agents and their capabilities</p>
      </div>
      
      <Suspense fallback={<Loading text="Loading dashboard..." />}>
        <AgentDashboardClient initialAgents={agents} teams={teams} />
      </Suspense>
    </div>
  );
}
