import { Suspense } from 'react';
import { getOrganizations } from '@/app/actions/organizations';
import { getTeams } from '@/app/actions/teams';
import { getRoles } from '@/app/actions/roles';
import { getTasks } from '@/app/actions/tasks';
import { EmeryProviders } from '@/components/EmeryProviders';
import OrganizationManager from './components/OrganizationManager';
import TeamManager from './components/TeamManager';
import RoleManager from './components/RoleManager';
import TaskManager from './components/TaskManager';
import { getAgents } from '@/app/actions/agents';

export default async function ManagePage() {
  const [organizations, teams, roles, tasksResult, agents] = await Promise.all([
    getOrganizations(),
    getTeams(),
    getRoles(),
    getTasks(undefined, 100), // Get recent tasks for all agents
    getAgents(),
  ]);

  const tasks = tasksResult.success ? tasksResult.data : [];

  return (
    <EmeryProviders>
      <div className="container mx-auto p-6 space-y-8">
        <h1 className="text-3xl font-bold">Orchestration</h1>
        
        {/* Tasks Dashboard - Full width */}
        <div className="w-full">
          <Suspense fallback={<div>Loading tasks...</div>}>
            <TaskManager 
              tasks={tasks} 
              agents={agents.map(a => ({id: a.id, name: a.name}))} 
            />
          </Suspense>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <Suspense fallback={<div>Loading organizations...</div>}>
              <OrganizationManager organizations={organizations} />
            </Suspense>
            
            <Suspense fallback={<div>Loading teams...</div>}>
              <TeamManager teams={teams} organizations={organizations} />
            </Suspense>
          </div>
          
          <div className="space-y-8">
            <Suspense fallback={<div>Loading roles...</div>}>
              <RoleManager roles={roles} />
            </Suspense>
          </div>
        </div>
      </div>
    </EmeryProviders>
  );
}
