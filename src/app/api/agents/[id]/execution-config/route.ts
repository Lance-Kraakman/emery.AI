/**
 * Agent Execution Config API Endpoint
 *
 * POST /api/agents/[id]/execution-config
 * Returns agent config + credentials for Python dynamic execution.
 * Checks agents:execute RBAC permission.
 *
 * Response includes:
 * - Full agent config (name, model, tools, etc.)
 * - Agent's API key for credential isolation
 *
 * AIDEV-NOTE: Part of dynamic execution architecture.
 * Python calls this to get agent config + credentials at runtime.
 * Different from /api/agents/[id]/execute which actually runs the agent.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam } from '@/lib/api/base';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { AgentMapper } from '@/app/mappers/agent-mapper';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { requirePermission } from '@/app/actions/permissions';

/**
 * POST /api/agents/[id]/execution-config
 * Get agent config + credentials for dynamic execution
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const agentId = parseIntParam(id, 'agent id');

    // Check agents:execute permission
    try {
      await requirePermission("agents:execute");
    } catch (error) {
      return {
        success: false,
        error: 'Permission denied: agents:execute required',
        status: 403
      };
    }

    const agentService = getAgentApplicationService();
    const agent = await agentService.getAgent(AgentId.fromNumber(agentId));

    if (!agent) {
      return {
        success: false,
        error: `Agent with ID ${agentId} not found`,
        status: 404
      };
    }

    // Convert domain entity to DTO for API response
    const agentDTO = AgentMapper.toDTO(agent);

    return {
      success: true,
      data: {
        agent: agentDTO,
        // Credential info for Python execution
        agentId: agentDTO.id,
        agentApiKey: agentDTO.apiKey,
      }
    };
  });
}
