import { Suspense } from 'react';
import { getTeams } from '@/app/actions/teams';
import { getAgents } from '@/app/actions/agents';
import { Loading } from '@/components/ui/loading';
import TeamDashboardClient from './components/TeamDashboardClient';

// AIDEV-NOTE: Teams page refactored to use consistent design patterns and improved error handling

export default async function TeamsPage() {
  // Fetch initial data on the server
  const [teams, agents] = await Promise.all([
    getTeams(),
    getAgents(),
  ]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teams</h1>
        <p className="text-muted-foreground">Manage your teams and their members</p>
      </div>
      
      <Suspense fallback={<Loading text="Loading dashboard..." />}>
        <TeamDashboardClient initialTeams={teams} agents={agents} />
      </Suspense>
    </div>
  );
}