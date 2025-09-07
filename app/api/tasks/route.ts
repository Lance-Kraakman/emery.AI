// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentTaskApplicationService } from '@/ddd/application/di/container';
import type { CreateTaskRequest } from '@/ddd/application/services/agents/agent-task-application-service';
import { AgentId, UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';

/**
 * Get tasks list using AgentTaskApplicationService
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    // Use AgentTaskApplicationService for task listing (RLS policies handle isolation automatically)
    const agentTaskApplicationService = getAgentTaskApplicationService();
    const organizationId = authResult.user.organizationId || 1;
    const allTasks = await agentTaskApplicationService.getTasksForOrganization(organizationId);

    return NextResponse.json({
      success: true,
      tasks: allTasks,
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, name, capabilityName, instructions } = body;

    // Validate required fields
    if (!agentId || !name || !capabilityName) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, name, capabilityName'
      }, { status: 400 });
    }

    // Use AgentTaskApplicationService for task creation (RLS policies handle isolation automatically)
    const agentTaskApplicationService = getAgentTaskApplicationService();

    const command: CreateTaskRequest = {
      agentId: AgentId.fromNumber(parseInt(agentId)),
      name,
      capabilityName,
      instructions: instructions || {},
      organizationId: OrganizationId.fromNumber(authResult.user.organizationId!),
      createdBy: UserId.fromString(authResult.user.id)
    };

    const task = await agentTaskApplicationService.createTask(command);
    
    return NextResponse.json({
      success: true,
      task
    }, { status: 201 });

  } catch (error) {
    console.error('API Error creating task:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}