/**
 * Organization Page (Server Component)
 *
 * Fetches skills data server-side and passes to client component.
 * Client component handles EmeryStore data (agents, databases).
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkillsByOrganization } from '@/app/actions/skills';
import { OrgChartPageClient } from './components/OrgChartPageClient';

export default async function OrganizationPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  // Fetch skills server-side
  const skillsResult = await getSkillsByOrganization(session.user.currentOrganizationId);

  // Transform to lightweight format for canvas
  const skillData = (skillsResult.data ?? []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    executionType: skill.executionType,
    agentId: skill.agentId ?? null,
  }));

  return <OrgChartPageClient skills={skillData} />;
}
