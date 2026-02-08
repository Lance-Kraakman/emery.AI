/**
 * Agent management API endpoint using AgentApplicationService
 * Supports REST API access for agent operations
 *
 * Query params for GET:
 * - name: Filter by agent name (exact match for @mention resolution)
 * - search: Filter by agent name (fuzzy search)
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody } from '@/lib/api/base';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import type { CreateAgentDTO } from '@/app/dtos/agent.dto';

/**
 * Create a new agent using AgentApplicationService
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);

    if (!body) {
      return { success: false, error: 'Invalid request body', status: 400 };
    }

    const {
      name,
      role,
      description,
      persona,
      organizationId,
      trigger,
    } = body;

    if (!name || !organizationId) {
      return {
        success: false,
        error: 'Missing required fields: name, organizationId',
        status: 400
      };
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
      ownerId: user.id,
      organizationId: parseInt(organizationId),
      automations: trigger ? [trigger] : []
    };

    const result = await agentApplicationService.createAgent(dto);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create agent',
        status: 400
      };
    }

    logAgentMutation(request, user, {
      action: 'create',
      resourceType: 'agent',
      resourceId: String(result.data?.id),
      resourceName: body.name,
    });

    return {
      success: true,
      data: {
        message: 'Agent created successfully',
        agent: result.data,
        id: result.data?.id, // For compatibility with tests
      }
    };
  });
}

/**
 * Get agents list using AgentApplicationService
 *
 * Query params:
 * - name: Filter by agent name (exact match, case-insensitive)
 * - search: Filter by agent name/description (fuzzy search)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user): Promise<any> => {
    const { searchParams } = new URL(request.url);
    const nameFilter = searchParams.get('name');
    const searchQuery = searchParams.get('search');

    const agentApplicationService = getAgentApplicationService();

    // If name filter, get specific agent by name (exact match)
    if (nameFilter) {
      const result = await agentApplicationService.getAgentByName(
        nameFilter,
        user.organizationId!
      );

      if (!result.success || !result.data) {
        return {
          success: false,
          error: `Agent '${nameFilter}' not found`,
          status: 404
        };
      }

      return {
        success: true,
        data: result.data,
      };
    }

    // Get all agents for current organization with optional search
    const userAgents = await agentApplicationService.getAgents({
      organizationId: user.organizationId!,
      searchQuery: searchQuery || undefined
    });

    // Return agents list
    return {
      success: true,
      data: userAgents,
    };
  });
}
