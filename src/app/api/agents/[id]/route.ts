/**
 * Single Agent Operations API Endpoint
 *
 * RESTful endpoints for individual agent management:
 * - GET: Retrieve single agent by ID
 * - PUT: Update agent metadata
 * - DELETE: Delete agent
 *
 * Uses standardized base utilities for consistent auth and error handling
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-read-agent etc.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { AgentId } from '@/ddd/domain/shared/value-objects';
import { AgentMapper } from '@/app/mappers/agent-mapper';

/**
 * GET /api/agents/[id]
 * Retrieve single agent by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const agentId = parseIntParam(id, 'agent id');
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
      data: agentDTO
    };
  });
}

/**
 * PUT /api/agents/[id]
 * Update agent metadata
 *
 * Request body fields (all optional):
 * {
 *   name?: string,
 *   role?: string,
 *   description?: string,
 *   persona?: string,
 *   status?: 'active' | 'inactive' | 'archived',
 *   schedules?: ScheduleConfigurationDTO[],
 *   defaultModel?: string | null,
 *   avatarConfig?: AvatarConfig | null
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const agentId = parseIntParam(id, 'agent id');
    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const agentService = getAgentApplicationService();

    // Build update DTO with agent ID
    const updateDTO = {
      id: agentId,
      ...body
    };

    const result = await agentService.updateAgent(updateDTO);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update agent',
        status: 400
      };
    }

    return {
      success: true,
      data: result.data,
      message: 'Agent updated successfully'
    };
  });
}

/**
 * DELETE /api/agents/[id]
 * Delete agent
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const agentId = parseIntParam(id, 'agent id');
    const agentService = getAgentApplicationService();

    // Verify agent exists before attempting deletion
    const agent = await agentService.getAgent(AgentId.fromNumber(agentId));

    if (!agent) {
      return {
        success: false,
        error: `Agent with ID ${agentId} not found`,
        status: 404
      };
    }

    // Delete agent
    const result = await agentService.deleteAgent(AgentId.fromNumber(agentId));

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete agent',
        status: 400
      };
    }

    return {
      success: true,
      data: { id: agentId },
      message: 'Agent deleted successfully'
    };
  });
}
