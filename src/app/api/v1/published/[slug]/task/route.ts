/**
 * External API - Task Execution Endpoint
 *
 * POST /api/v1/published/:slug/task
 *
 * Execute a natural language task on a published agent.
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
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // 1. Authenticate
    const auth = await authenticatePublishedAgentRequest(request, slug);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    // 2. Check scope
    if (!hasScope(auth, 'task:execute')) {
      return NextResponse.json(
        { success: false, error: 'API key does not have task:execute scope' },
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

    // 4. Parse request body
    const body = await request.json();
    if (!body.task || typeof body.task !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "task" field' },
        { status: 400 }
      );
    }

    // 5. Execute task
    const result = await executionService.executeTask(
      slug,
      organizationId,
      body.task,
      auth.keyId!,
      {
        clientIp: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error('[PublishedAgent:Task] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
