import { Suspense } from 'react';
import { getOrganizations } from '@/app/actions/organizations';
import { getTeams } from '@/app/actions/teams';
import { getWorkers } from '@/app/actions/workers';
import { getRoles } from '@/app/actions/roles';
import OrganizationManager from './components/OrganizationManager';
import TeamManager from './components/TeamManager';
import WorkerManager from './components/WorkerManager';
import RoleManager from './components/RoleManager';

export default async function ManagePage() {
  const [organizations, teams, workers, roles] = await Promise.all([
    getOrganizations(),
    getTeams(),
    getWorkers(),
    getRoles(),
  ]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">System Management</h1>
      
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
          <Suspense fallback={<div>Loading workers...</div>}>
            <WorkerManager workers={workers} />
          </Suspense>
          
          <Suspense fallback={<div>Loading roles...</div>}>
            <RoleManager roles={roles} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}