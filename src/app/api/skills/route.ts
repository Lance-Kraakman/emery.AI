/**
 * Skills List API Endpoint
 *
 * RESTful endpoint for listing skills:
 * - GET: List skills with optional agent filter
 *
 * Query params:
 * - agent_id: Filter skills for a specific agent
 *
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-list-skills
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getSkillApplicationService, getAgentApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { logAgentMutation } from '@/lib/api/agent-context';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';

/**
 * GET /api/skills
 * List skills with optional filters
 *
 * Query params:
 * - agent_id: Filter skills for a specific agent
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get('agent_id');
    const organizationId = authResult.user.organizationId;

    if (!organizationId) {
      return Response.json({
        success: false,
        error: 'No organization context'
      }, { status: 400 });
    }

    const skillService = getSkillApplicationService();

    // If agent_id is provided, get skills for that agent
    if (agentIdParam) {
      const agentId = parseInt(agentIdParam, 10);
      if (isNaN(agentId)) {
        return Response.json({
          success: false,
          error: 'Invalid agent_id parameter'
        }, { status: 400 });
      }

      const result = await skillService.getSkillsByAgent(agentId);

      if (!result.success) {
        return Response.json({
          success: false,
          error: result.error || 'Failed to fetch skills'
        }, { status: 400 });
      }

      const skills = SkillMapper.toDTOList(result.data || []);

      return Response.json({
        success: true,
        data: skills
      });
    }

    // Otherwise, get all organization skills
    const result = await skillService.getSkillsByOrganization(organizationId);

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to fetch skills'
      }, { status: 400 });
    }

    const skills = SkillMapper.toDTOList(result.data || []);

    return Response.json({
      success: true,
      data: skills
    });

  } catch (error) {
    console.error('Error fetching skills:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/skills
 * Create a new skill
 *
 * Required body fields:
 * - name: string
 * - agentId: number
 *
 * Optional body fields:
 * - description, instructions, inputs, outputs, tools, model,
 *   executionType, steps, canvasMetadata, taskModelConfig,
 *   toolExecutionConfig, writeConfig, readConfig
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, agentId } = body;

    if (!name?.trim()) {
      return Response.json({
        success: false,
        error: 'Missing required field: name'
      }, { status: 400 });
    }

    if (!agentId) {
      return Response.json({
        success: false,
        error: 'Missing required field: agentId'
      }, { status: 400 });
    }

    const parsedAgentId = parseInt(agentId, 10);
    if (isNaN(parsedAgentId)) {
      return Response.json({
        success: false,
        error: 'Invalid agentId: must be a number'
      }, { status: 400 });
    }

    // Get agent to retrieve organizationId
    const agentService = getAgentApplicationService();
    const agent = await agentService.getAgent(AgentId.fromNumber(parsedAgentId));
    if (!agent) {
      return Response.json({
        success: false,
        error: 'Agent not found'
      }, { status: 404 });
    }

    // Normalize tools: convert string entries to {name: string} objects
    if (Array.isArray(body.tools)) {
      body.tools = body.tools.map((t: any) =>
        typeof t === 'string' ? { name: t } : t
      );
    }

    const skillService = getSkillApplicationService();
    const result = await skillService.createSkill({
      ...body,
      agentId: parsedAgentId,
      name: name.trim(),
      instructions: body.instructions || '',
      tools: body.tools || [],
      inputs: body.inputs || [],
      outputs: body.outputs || [],
      organizationId: agent.organizationId.value,
    });

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to create skill'
      }, { status: 400 });
    }

    // Fetch the created skill to return full DTO
    const skillResult = await skillService.getSkill(result.data!.value);
    if (!skillResult.success || !skillResult.data) {
      return Response.json({
        success: false,
        error: 'Failed to fetch created skill'
      }, { status: 500 });
    }

    logAgentMutation(request, authResult.user, {
      action: 'create',
      resourceType: 'skill',
      resourceId: String(result.data!.value),
      resourceName: name,
    });

    return Response.json({
      success: true,
      data: SkillMapper.toDTO(skillResult.data),
      message: 'Skill created successfully'
    });

  } catch (error) {
    console.error('Error creating skill:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
