/**
 * External API - Skill Execution Endpoint
 *
 * POST /api/v1/published/:slug/skills/:skillName
 *
 * Execute a specific skill with typed inputs on a published agent.
 * Requires API key authentication via X-API-Key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticatePublishedAgentRequest,
  hasScope,
  getPublishedAgentOrganization,
} from '@/lib/auth/published-agent-auth';
import { db } from '@/ddd/infrastructure/db/client';
import {
  DrizzlePublishedAgentRepository,
  DrizzlePublishedAgentApiKeyRepository,
  DrizzlePublishedAgentUsageLogRepository,
} from '@/ddd/infrastructure/db/repositories/published-agents';
import { DrizzleSkillRepository } from '@/ddd/infrastructure/db/repositories/skills/drizzle-skill-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { ExternalExecutionService } from '@/ddd/application/services/published-agents';

// Initialize repositories and service
const publishedAgentRepository = new DrizzlePublishedAgentRepository(db);
const apiKeyRepository = new DrizzlePublishedAgentApiKeyRepository(db);
const usageLogRepository = new DrizzlePublishedAgentUsageLogRepository(db);
const skillRepository = new DrizzleSkillRepository(db);
const agentRepository = new DrizzleAgentRepository(db);

const executionService = new ExternalExecutionService(
  publishedAgentRepository,
  apiKeyRepository,
  usageLogRepository,
  skillRepository,
  agentRepository
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; skillName: string }> }
) {
  try {
    const { slug, skillName } = await params;

    // 1. Authenticate
    const auth = await authenticatePublishedAgentRequest(request, slug);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // 2. Check scope
    if (!hasScope(auth, 'skill:execute')) {
      return NextResponse.json(
        { success: false, error: 'API key does not have skill:execute scope' },
        { status: 403 }
      );
    }

    // 3. Get organization ID
    const organizationId = await getPublishedAgentOrganization(auth.publishedAgentId!);
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 500 }
      );
    }

    // 4. Parse request body (inputs for the skill)
    let inputs: Record<string, unknown> = {};
    try {
      const body = await request.json();
      inputs = body ?? {};
    } catch {
      // Empty body is OK for skills with no required inputs
    }

    // 5. Execute skill
    const result = await executionService.executeSkill(
      slug,
      organizationId,
      skillName,
      inputs,
      auth.keyId!,
      {
        clientIp: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      }
    );

    if (!result.success) {
      // Determine appropriate status code
      const statusCode = result.error?.includes('not found') ? 404 : 400;
      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[PublishedAgent:Skill] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
