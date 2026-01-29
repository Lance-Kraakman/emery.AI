/**
 * Team List API Endpoint
 *
 * RESTful endpoints for team operations:
 * - GET: List teams for organization
 * - POST: Create new team
 *
 * AIDEV-NOTE: Created to support Python CRUD tools
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody } from '@/lib/api/base';
import { getTeamApplicationService } from '@/ddd/application/di/container';
import { TeamMapper } from '@/app/mappers/team-mapper';

/**
 * GET /api/teams
 * List teams for the authenticated user's organization
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const teamService = getTeamApplicationService();

    const teams = await teamService.getTeams({
      organizationId: user.organizationId
    });

    // Map domain entities to DTOs
    const teamDTOs = teams.map(team => TeamMapper.toDTO(team));

    return {
      success: true,
      data: teamDTOs
    };
  });
}

/**
 * POST /api/teams
 * Create a new team
 *
 * Request body:
 * {
 *   name: string,
 *   purpose?: string,
 *   description?: string,
 *   responsibilities?: string[],
 *   goals?: string[],
 *   agentIds?: string[],
 *   databaseId?: string
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    if (!body.name) {
      return {
        success: false,
        error: 'Team name is required',
        status: 400
      };
    }

    const teamService = getTeamApplicationService();

    const result = await teamService.createTeam({
      name: body.name,
      purpose: body.purpose,
      description: body.description,
      responsibilities: body.responsibilities,
      goals: body.goals,
      agentIds: body.agentIds,
      databaseId: body.databaseId,
      organizationId: user.organizationId,
      ownerId: user.id
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create team',
        status: 400
      };
    }

    return {
      success: true,
      data: result.data,
      message: 'Team created successfully'
    };
  });
}
