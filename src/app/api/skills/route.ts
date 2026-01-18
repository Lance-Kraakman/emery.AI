// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Skills List API Endpoint
 *
 * RESTful endpoint for listing skills:
 * - GET: List skills with optional agent filter
 *
 * Query params:
 * - agent_id: Filter skills for a specific agent
 * - format: 'llm' for TOON format output
 * - meta: '1' to include metadata in TOON format
 *
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-list-skills
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getSkillApplicationService } from '@/ddd/application/di/container';
import { SkillMapper } from '@/app/mappers/skill-mapper';
import { skillsToToon } from '@/lib/toon-format';

/**
 * GET /api/skills
 * List skills with optional filters
 *
 * Query params:
 * - agent_id: Filter skills for a specific agent
 * - format: 'llm' for TOON format output
 * - meta: '1' to include metadata in TOON format
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentIdParam = searchParams.get('agent_id');
    const format = searchParams.get('format');
    const includeMeta = searchParams.get('meta') === '1';
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

      // TOON format for LLM consumption
      if (format === 'llm') {
        const toon = skillsToToon(skills, { includeMeta });
        return new Response(toon, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

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

    // TOON format for LLM consumption
    if (format === 'llm') {
      const toon = skillsToToon(skills, { includeMeta });
      return new Response(toon, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

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
