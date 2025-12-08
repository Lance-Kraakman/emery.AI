// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Skills List API Endpoint
 *
 * RESTful endpoint for listing skills:
 * - GET: List skills with optional agent filter
 *
 * Uses standardized base utilities for consistent auth and error handling
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-list-skills
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getSkillApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';

/**
 * GET /api/skills
 * List skills with optional filters
 *
 * Query params:
 * - agent_id: Filter skills for a specific agent
 * - organization_id: Filter skills for a specific organization (uses user's org if not provided)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get('agent_id');
    const organizationId = user.organizationId;

    if (!organizationId) {
      return {
        success: false,
        error: 'No organization context',
        status: 400
      };
    }

    const skillService = getSkillApplicationService();

    // If agent_id is provided, get skills for that agent
    if (agentIdParam) {
      const agentId = parseInt(agentIdParam, 10);
      if (isNaN(agentId)) {
        return {
          success: false,
          error: 'Invalid agent_id parameter',
          status: 400
        };
      }

      const result = await skillService.getSkillsByAgent(agentId);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to fetch skills',
          status: 400
        };
      }

      return {
        success: true,
        data: SkillMapper.toDTOList(result.data || [])
      };
    }

    // Otherwise, get all organization skills
    const result = await skillService.getSkillsByOrganization(organizationId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch skills',
        status: 400
      };
    }

    return {
      success: true,
      data: SkillMapper.toDTOList(result.data || [])
    };
  });
}
