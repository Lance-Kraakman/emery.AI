/**
 * Single Team Operations API Endpoint
 *
 * RESTful endpoints for individual team management:
 * - GET: Retrieve single team by ID
 * - PUT: Update team metadata
 * - DELETE: Delete team
 *
 * AIDEV-NOTE: Created to support Python CRUD tools
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTeamApplicationService } from '@/ddd/application/di/container';
import { TeamMapper } from '@/app/mappers/team-mapper';

/**
 * GET /api/teams/[id]
 * Retrieve single team by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const teamId = parseIntParam(id, 'team id');
    const teamService = getTeamApplicationService();

    const team = await teamService.getTeam(teamId);

    if (!team) {
      return {
        success: false,
        error: `Team with ID ${teamId} not found`,
        status: 404
      };
    }

    // Convert domain entity to DTO for API response
    const teamDTO = TeamMapper.toDTO(team);

    return {
      success: true,
      data: teamDTO
    };
  });
}

/**
 * PUT /api/teams/[id]
 * Update team metadata
 *
 * Request body fields (all optional):
 * {
 *   name?: string,
 *   purpose?: string,
 *   description?: string,
 *   responsibilities?: string[],
 *   goals?: string[],
 *   agentIds?: string[]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const teamId = parseIntParam(id, 'team id');
    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const teamService = getTeamApplicationService();

    const result = await teamService.updateTeam({
      id: teamId,
      name: body.name,
      purpose: body.purpose,
      description: body.description,
      responsibilities: body.responsibilities,
      goals: body.goals,
      agentIds: body.agentIds
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update team',
        status: 400
      };
    }

    logAgentMutation(request, user, {
      action: 'update',
      resourceType: 'team',
      resourceId: String(teamId),
      resourceName: body.name,
    });

    return {
      success: true,
      data: result.data,
      message: 'Team updated successfully'
    };
  });
}

/**
 * DELETE /api/teams/[id]
 * Delete team
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const teamId = parseIntParam(id, 'team id');
    const teamService = getTeamApplicationService();

    // Verify team exists before attempting deletion
    const team = await teamService.getTeam(teamId);

    if (!team) {
      return {
        success: false,
        error: `Team with ID ${teamId} not found`,
        status: 404
      };
    }

    // Delete team
    const teamName = team.name;
    const result = await teamService.deleteTeam(teamId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete team',
        status: 400
      };
    }

    logAgentMutation(request, user, {
      action: 'delete',
      resourceType: 'team',
      resourceId: String(teamId),
      resourceName: teamName,
    });

    return {
      success: true,
      data: { id: teamId },
      message: 'Team deleted successfully'
    };
  });
}
