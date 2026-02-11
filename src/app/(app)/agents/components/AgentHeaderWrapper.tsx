import { getSkillsByAgent } from '@/app/actions/skills';
import { getConnectionSummary } from '@/app/actions/connections';
import { getCurrentOrganization } from '@/app/actions/user-organizations';
import { CompactAgentHeader } from './CompactAgentHeader';
import type { AgentDTO } from '@/app/dtos/agent.dto';
import { getModelMetadata } from '@/lib/ai/model-registry';

// AIDEV-NOTE: Server component wrapper for CompactAgentHeader
// Fetches skills and connection count in parallel, enabling React streaming
// Uses getConnectionSummary() instead of getUserOAuthConnections() for faster loading
// The modal loads its own full connection data when opened

interface AgentHeaderWrapperProps {
  agent: AgentDTO;
}

export async function AgentHeaderWrapper({ agent }: AgentHeaderWrapperProps) {
  // Fetch skills, connection summary, and organization in parallel
  // Connection summary is much faster than fetching all connections
  const [skillsResult, connectionSummaryResult, organization] = await Promise.all([
    getSkillsByAgent(agent.id),
    getConnectionSummary(),
    getCurrentOrganization()
  ]);

  const skills = skillsResult.success ? (skillsResult.data || []) : [];
  const connectionCount = connectionSummaryResult.success
    ? connectionSummaryResult.data?.totalConnections || 0
    : 0;

  // Resolve model: agent -> organization -> nothing
  const resolvedModelId = agent.defaultModel || organization?.defaultModel || null;
  const resolvedModel = resolvedModelId
    ? (getModelMetadata(resolvedModelId)?.name || resolvedModelId)
    : null;

  return (
    <CompactAgentHeader
      agent={agent}
      skills={skills}
      connectionCount={connectionCount}
      resolvedModel={resolvedModel}
    />
  );
}
