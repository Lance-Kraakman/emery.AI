import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { tasks, agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAgentTaskApplicationService } from '@/ddd/application/di';

export interface TaskCancelRequest {
  reason?: string;
}

/**
 * Cancel a running task via gRPC worker
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const params = await context.params;
  try {
    const session = await auth();
    
    // AIDEV-NOTE: Development bypass for testing - remove in production
    let userId = session?.user?.id;
    if (!session?.user && process.env.NODE_ENV === 'development') {
      const testUserId = request.headers.get('x-test-user-id');
      if (testUserId === '550e8400-e29b-41d4-a716-446655440000') {
        userId = testUserId;
      } else {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taskId = params.id;
    const body: TaskCancelRequest = await request.json().catch(() => ({}));

    // Get task and associated agent
    const [taskWithAgent] = await db
      .select({
        task: tasks,
        agent: agents,
      })
      .from(tasks)
      .innerJoin(agents, eq(tasks.agentId, agents.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!taskWithAgent) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    const { task, agent } = taskWithAgent;

    // Verify agent ownership
    if (agent.ownerId !== userId) {
      return Response.json({ 
        error: 'Access denied: You can only cancel tasks for agents you own' 
      }, { status: 403 });
    }

    // Check if task is still running
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(task.status)) {
      return Response.json({ 
        error: `Task is already ${task.status} and cannot be cancelled` 
      }, { status: 400 });
    }

    // Cancel task via DDD application service
    const agentTaskService = getAgentTaskApplicationService();
    
    try {
      await agentTaskService.cancelTask(taskId, body.reason);
      
      return Response.json({
        success: true,
        message: `Task ${taskId} cancelled successfully`,
        task_id: taskId,
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel task',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error cancelling task:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}