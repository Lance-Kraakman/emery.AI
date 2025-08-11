import { Suspense } from 'react';
import { getAgents } from '@/app/actions/agents';
import { getTeams } from '@/app/actions/teams';
import { getTasks } from '@/app/actions/tasks';
import { Loading } from '@/components/ui/loading';
import OrganizationChart from './components/OrganizationChart';

// AIDEV-NOTE: Organization page refactored to use consistent design patterns and improved loading states

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
        <Suspense fallback={<Loading text="Loading organization chart..." />}>
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