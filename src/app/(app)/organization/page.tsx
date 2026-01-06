/**
 * Organization Page (Server Component)
 *
 * Fetches skills data and canvas metadata server-side and passes to client component.
 * Client component handles EmeryStore data (agents, databases).
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSkillsByOrganization } from '@/app/actions/skills';
import { getOrgChartCanvasMetadata } from '@/app/actions/organizations';
import { OrgChartPageClient } from './components/OrgChartPageClient';

export default async function OrganizationPage() {
  const session = await auth();

  if (!session?.user?.currentOrganizationId) {
    redirect('/login');
  }

  // Fetch skills and canvas metadata server-side in parallel
  const [skillsResult, canvasMetadataResult] = await Promise.all([
    getSkillsByOrganization(session.user.currentOrganizationId),
    getOrgChartCanvasMetadata(),
  ]);

  // Transform to lightweight format for canvas
  const skillData = (skillsResult.data ?? []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    executionType: skill.executionType,
    agentId: skill.agentId ?? null,
  }));

  const canvasMetadata = canvasMetadataResult.success ? canvasMetadataResult.data : undefined;

  return <OrgChartPageClient skills={skillData} canvasMetadata={canvasMetadata} />;
}
