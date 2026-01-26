/**
 * Agent management API endpoint using AgentApplicationService
 * Supports REST API access for agent operations
 *
 * Query params for GET:
 * - name: Filter by agent name (for @mention resolution)
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import type { CreateAgentDTO } from '@/app/dtos/agent.dto';

/**
 * Create a new agent using AgentApplicationService
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    const body = await request.json();
    const {
      name,
      role,
      description,
      persona,
      organizationId,
      trigger,
      skills
    } = body;

    if (!name || !organizationId) {
      return Response.json({
        error: 'Missing required fields: name, organizationId'
      }, { status: 400 });
    }

    // Use AgentApplicationService for agent creation
    const agentApplicationService = getAgentApplicationService();

    // Build DTO - Application Service handles Value Object conversion
    // Don't provide a default trigger - let agents be created without automations
    const dto: CreateAgentDTO = {
      name,
      role,
      description,
      persona,
      ownerId: userId,
      organizationId: parseInt(organizationId),
      automations: trigger ? [trigger] : []
    };

    const result = await agentApplicationService.createAgent(dto);

    if (!result.success) {
      return Response.json({
        success: false,
        error: result.error || 'Failed to create agent'
      }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Agent created successfully',
      agent: result.data,
      id: result.data?.id, // For compatibility with tests
    });

  } catch (error) {
    console.error('Error creating agent:', error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Get agents list using AgentApplicationService
 *
 * Query params:
 * - name: Filter by agent name (exact match, case-insensitive)
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);

    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;
    const organizationId = authResult.user.organizationId;
    const { searchParams } = new URL(request.url);
    const nameFilter = searchParams.get('name');

    const agentApplicationService = getAgentApplicationService();

    // If name filter, get specific agent by name
    if (nameFilter) {
      const result = await agentApplicationService.getAgentByName(
        nameFilter,
        organizationId!
      );

      if (!result.success || !result.data) {
        return Response.json({
          success: false,
          error: `Agent '${nameFilter}' not found`
        }, { status: 404 });
      }

      return Response.json({
        success: true,
        data: result.data,
      });
    }

    // Get all agents for owner
    const userAgents = await agentApplicationService.getAgentsByOwner(userId);

    return Response.json({
      success: true,
      agents: userAgents,
    });

  } catch (error) {
    console.error('Error fetching agents:', error);
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
