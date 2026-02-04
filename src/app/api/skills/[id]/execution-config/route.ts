/**
 * Skill Execute API Endpoint
 *
 * POST /api/skills/[id]/execute
 * Returns full skill config for Python dynamic execution.
 * Checks skills:execute RBAC permission.
 *
 * Response includes:
 * - Full skill config (instructions, inputs, outputs, tools, etc.)
 * - agentId for credential resolution
 * - Agent's API key if skill is agent-owned (for credential isolation)
 *
 * AIDEV-NOTE: Part of dynamic execution architecture.
 * Python calls this to get skill config + credentials at runtime.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam } from '@/lib/api/base';
import { getSkillApplicationService, getAgentApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { requirePermission } from '@/app/actions/permissions';
import { ensureFreshAgentApiKey } from '@/lib/auth/agent-api-keys';

/**
 * POST /api/skills/[id]/execute
 * Get skill config for execution with RBAC check
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const skillId = parseIntParam(id, 'skill id');

    // Check skills:execute permission
    try {
      await requirePermission("skills:execute");
    } catch (error) {
      return {
        success: false,
        error: 'Permission denied: skills:execute required',
        status: 403
      };
    }

    const skillService = getSkillApplicationService();

    const result = await skillService.getSkill(skillId);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: `Skill with ID ${skillId} not found`,
        status: 404
      };
    }

    // Convert domain entity to DTO for API response
    const skillDTO = SkillMapper.toDTO(result.data);

    // If skill is agent-owned, include agent's API key for credential isolation
    let agentApiKey: string | null = null;

    if (skillDTO.agentId) {
      const agentService = getAgentApplicationService();
      const agent = await agentService.getAgent(AgentId.fromNumber(skillDTO.agentId));

      if (!agent) {
        return {
          success: false,
          error: `Skill references non-existent agent (agentId=${skillDTO.agentId}). Skill is misconfigured.`,
          status: 400
        };
      }

      // Generate fresh agent API key (plaintext for tool auth, hash stored in DB)
      agentApiKey = await ensureFreshAgentApiKey(agent.id.value);
    }

    return {
      success: true,
      data: {
        skill: skillDTO,
        // Credential resolution info
        agentId: skillDTO.agentId,
        agentApiKey: agentApiKey,
      }
    };
  });
}
