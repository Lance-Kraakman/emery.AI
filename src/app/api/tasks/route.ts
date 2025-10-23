// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentTaskApplicationService } from '@/ddd/application/di/container';
import type { CreateTaskDTO } from '@/app/dtos/task.dto';

/**
 * Get tasks list using AgentTaskApplicationService
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    // Use AgentTaskApplicationService for task listing (service returns DTOs)
    const agentTaskApplicationService = getAgentTaskApplicationService();
    const organizationId = authResult.user.organizationId || 1;
    const tasks = await agentTaskApplicationService.getTasksForOrganization(organizationId);

    return NextResponse.json({
      success: true,
      tasks,
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

    // Use AgentTaskApplicationService for task creation (service accepts primitives)
    const agentTaskApplicationService = getAgentTaskApplicationService();

    const dto: CreateTaskDTO = {
      agentId: parseInt(agentId),
      name,
      capabilityName,
      instructions: instructions || {},
      organizationId: authResult.user.organizationId!,
      createdBy: authResult.user.id
    };

    const result = await agentTaskApplicationService.createTask(dto);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      task: result.data
    }, { status: 201 });

  } catch (error) {
    console.error('API Error creating task:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}