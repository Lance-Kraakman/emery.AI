// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Single Skill Operations API Endpoint
 *
 * RESTful endpoints for individual skill management:
 * - GET: Retrieve single skill by ID
 * - PUT: Update skill configuration
 *
 * Uses standardized base utilities for consistent auth and error handling
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-read-skill etc.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { getSkillApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';

/**
 * GET /api/skills/[id]
 * Retrieve single skill by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const skillId = parseIntParam(id, 'skill id');
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

    return {
      success: true,
      data: skillDTO
    };
  });
}

/**
 * PUT /api/skills/[id]
 * Update skill configuration
 *
 * Request body fields (all optional):
 * {
 *   name?: string,
 *   description?: string,
 *   instructions?: string,
 *   inputs?: SkillInput[],
 *   outputs?: SkillOutput[],
 *   tools?: ToolConfigDTO[],
 *   content?: MessagePart[],
 *   model?: string | null
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const skillId = parseIntParam(id, 'skill id');
    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const skillService = getSkillApplicationService();

    // First verify skill exists
    const existingSkill = await skillService.getSkill(skillId);
    if (!existingSkill.success || !existingSkill.data) {
      return {
        success: false,
        error: `Skill with ID ${skillId} not found`,
        status: 404
      };
    }

    // Update skill
    const result = await skillService.updateSkill(skillId, body);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update skill',
        status: 400
      };
    }

    // Fetch updated skill to return full DTO
    const updatedSkill = await skillService.getSkill(skillId);
    if (!updatedSkill.success || !updatedSkill.data) {
      return {
        success: false,
        error: 'Failed to fetch updated skill',
        status: 500
      };
    }

    return {
      success: true,
      data: SkillMapper.toDTO(updatedSkill.data),
      message: 'Skill updated successfully'
    };
  });
}
