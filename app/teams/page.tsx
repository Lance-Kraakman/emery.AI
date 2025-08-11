import { Suspense } from 'react';
import { getTeams } from '@/app/actions/teams';
import { getAgents } from '@/app/actions/agents';
import TeamDashboardClient from './components/TeamDashboardClient';

export default async function TeamsPage() {
  // Fetch initial data on the server
  const [teams, agents] = await Promise.all([
    getTeams(),
    getAgents(),
  ]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Teams</h1>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <TeamDashboardClient initialTeams={teams} agents={agents} />
      </Suspense>
    </div>
  );
}