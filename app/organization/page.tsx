import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { getTasks } from '@/app/actions/tasks';
import OrganizationChart from './components/OrganizationChart';

export default async function OrganizationPage() {
  // Fetch initial data on the server
  const [agents, teams, tasksResult] = await Promise.all([
    getAgents(),
    getTeams(),
    getTasks(),
  ]);

  const tasks = tasksResult.success ? tasksResult.data : [];

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div>Loading organization chart...</div>}>
          <OrganizationChart 
            initialAgents={agents} 
            initialTeams={teams}
            initialTasks={tasks}
          />
        </Suspense>
      </div>
    </div>
  );
}