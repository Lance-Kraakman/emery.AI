import React, { Suspense } from 'react';
import { getTeams } from '@/src/app/actions/teams';
import { getAgents } from '@/src/app/actions/agents';
import { Loading } from '@/src/components/ui/loading';
import { auth } from '@/src/lib/auth';
import { TeamsPage as TeamsPageLayout } from '@/src/components/canvas';
import TeamDashboardClient from './components/TeamDashboardClient';

// AIDEV-NOTE: Teams page updated to use canvas architecture with collapsible layout
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
    <TeamsPageLayout>
      <Suspense fallback={<Loading text="Loading teams..." />}>
        <TeamDashboardClient initialTeams={teams} agents={agents} />
      </Suspense>
    </TeamsPageLayout>
  );
}