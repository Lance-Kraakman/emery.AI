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
  // Include steps and skill-level I/O mappings for edge extraction
  const skillData = (skillsResult.data ?? []).map((skill) => ({
    id: skill.id,
    name: skill.name,
    executionType: skill.executionType,
    agentId: skill.agentId ?? null,
    // Extract minimal step data needed for edge generation
    steps: skill.steps?.map((step) => ({
      id: step.id,
      skillId: step.skillId, // For skill_ref edges
      readConfig: step.readConfig ? { sourceTableId: step.readConfig.sourceTableId } : undefined,
      writeConfig: step.writeConfig ? { targetTableId: step.writeConfig.targetTableId } : undefined,
    })),
    // Skill-level I/O mappings for edge generation (reads FROM / writes TO tables)
    inputs: skill.inputs?.map((input) => ({
      name: input.name,
      inputMapping: input.inputMapping ? {
        source: { tableId: input.inputMapping.source?.tableId }
      } : undefined,
    })),
    outputs: skill.outputs?.map((output) => ({
      name: output.name,
      outputMapping: output.outputMapping ? {
        tableMappings: output.outputMapping.tableMappings?.map((tm) => ({
          targetTableId: tm.targetTableId
        }))
      } : undefined,
    })),
  }));

  const canvasMetadata = canvasMetadataResult.success ? canvasMetadataResult.data : undefined;

  return <OrgChartPageClient skills={skillData} canvasMetadata={canvasMetadata} />;
}
