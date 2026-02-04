import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { hasPermission } from '@/lib/auth';
import { getAgentTaskApplicationService } from '@/ddd/application/di/container';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository, getOrganizationRepository } from '@/ddd/application/di/getters';
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
    if (!authResult.user.organizationId || !await hasPermission(authResult.user.id, 'tasks:view', authResult.user.organizationId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Use AgentTaskApplicationService for task listing (service returns DTOs)
    const agentTaskApplicationService = getAgentTaskApplicationService();
    const organizationId = authResult.user.organizationId;
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
    if (!authResult.user.organizationId || !await hasPermission(authResult.user.id, 'tasks:create', authResult.user.organizationId)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { agentId, name, instructions } = body;

    // Validate required fields
    if (!agentId || !name || !instructions) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: agentId, name, instructions'
      }, { status: 400 });
    }

    // Check token quota before creating task
    const organizationId = authResult.user.organizationId!;
    const tokenUsageRepo = getTokenUsageRepository();
    const orgRepo = getOrganizationRepository();
    const tokenUsageService = new TokenUsageApplicationService(tokenUsageRepo, orgRepo);
    const quotaCheck = await tokenUsageService.checkQuota(organizationId);

    if (quotaCheck.quotaExceeded) {
      return NextResponse.json({
        success: false,
        error: 'Monthly token quota exceeded',
        message: 'Your organization has exceeded its monthly token quota. Please upgrade your plan or wait until the quota resets.',
        currentUsage: quotaCheck.currentUsage,
        monthlyQuota: quotaCheck.monthlyQuota,
        percentageUsed: quotaCheck.percentageUsed
      }, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': quotaCheck.monthlyQuota?.toString() || 'unlimited',
          'X-RateLimit-Remaining': Math.max(0, (quotaCheck.monthlyQuota || 0) - quotaCheck.currentUsage).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
    }

    // Use AgentTaskApplicationService for task creation (service accepts primitives)
    const agentTaskApplicationService = getAgentTaskApplicationService();

    const dto: CreateTaskDTO = {
      agentId: parseInt(agentId),
      name,
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