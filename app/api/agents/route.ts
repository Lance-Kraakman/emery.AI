/**
 * Agent management API endpoint using AgentApplicationService
 * Supports REST API access for agent operations
 */

// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import type { CreateAgentCommand } from '@/ddd/application/services/agents/agent-application-service';
import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';

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
      capabilities,
      tools,
      servers 
    } = body;

    if (!name || !organizationId) {
      return Response.json({ 
        error: 'Missing required fields: name, organizationId' 
      }, { status: 400 });
    }

    // Use AgentApplicationService for agent creation
    const agentApplicationService = getAgentApplicationService();

    const command: CreateAgentCommand = {
      name,
      role,
      description,
      persona,
      ownerId: UserId.fromString(userId),
      organizationId: OrganizationId.fromNumber(parseInt(organizationId)),
      roleId: 1, // Default role ID - will be set by application layer
      trigger: trigger || { type: 'MANUAL', enabled: true },
      capabilities: capabilities || [],
      tools: tools || [],
      servers: servers || []
    };

    const result = await agentApplicationService.createAgent(command);

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
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Use AgentApplicationService for agent listing
    const agentApplicationService = getAgentApplicationService();
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