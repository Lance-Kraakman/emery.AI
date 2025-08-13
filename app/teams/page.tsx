import { Suspense } from 'react';
import { getTeams } from '@/app/actions/teams';
import { getAgents } from '@/app/actions/agents';
import { Loading } from '@/components/ui/loading';
import { auth } from '@/lib/auth';
import TeamDashboardClient from './components/TeamDashboardClient';

// AIDEV-NOTE: Teams page refactored to use consistent design patterns and improved error handling
// AIDEV-NOTE: Page is dynamic due to session/organization context requirements

export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  // Get current user's organization
  const session = await auth();
  const organizationId = session?.user?.currentOrganizationId;

  // Fetch initial data on the server
  const [teams, agents] = await Promise.all([
    getTeams(organizationId),
    getAgents(),
  ]);

  return (
    <div className="h-full">
      <Suspense fallback={<Loading text="Loading dashboard..." />}>
        <TeamDashboardClient initialTeams={teams} agents={agents} />
      </Suspense>
    </div>
  );
}