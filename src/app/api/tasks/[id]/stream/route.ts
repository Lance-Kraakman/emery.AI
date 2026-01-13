import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/ddd/infrastructure/db/client';
import { tasks, agents } from '@/ddd/infrastructure/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Stream real-time task progress updates via Server-Sent Events (SSE)
 */
export async function GET(
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
        return new Response('Unauthorized', { status: 401 });
      }
    } else if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const taskId = params.id;

    // Verify task exists and user has access
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
      return new Response('Task not found', { status: 404 });
    }

    const { task, agent } = taskWithAgent;

    // Verify agent ownership
    if (agent.ownerId !== userId) {
      return new Response('Access denied', { status: 403 });
    }

    // Create Server-Sent Events stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial task status
        const initialData = {
          type: 'task_status',
          task_id: taskId,
          status: task.status,
          result: task.result,
          error: task.error,
          started_at: task.startedAt,
          completed_at: task.completedAt,
          timestamp: new Date().toISOString(),
        };
        
        const initialMessage = `data: ${JSON.stringify(initialData)}\n\n`;
        controller.enqueue(encoder.encode(initialMessage));

        // If task is already completed, close stream
        if (task.status === 'completed' || task.status === 'failed') {
          const endMessage = `data: ${JSON.stringify({
            type: 'stream_end',
            task_id: taskId,
            final_status: task.status,
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(endMessage));
          controller.close();
          return;
        }

        // Poll for task updates
        const pollInterval = setInterval(async () => {
          try {
            const [updatedTask] = await db
              .select()
              .from(tasks)
              .where(eq(tasks.id, taskId))
              .limit(1);

            if (!updatedTask) {
              controller.close();
              clearInterval(pollInterval);
              return;
            }

            // Send update if task status changed
            const updateData = {
              type: 'task_update',
              task_id: taskId,
              status: updatedTask.status,
              result: updatedTask.result,
              error: updatedTask.error,
              started_at: updatedTask.startedAt,
              completed_at: updatedTask.completedAt,
              timestamp: new Date().toISOString(),
            };

            const updateMessage = `data: ${JSON.stringify(updateData)}\n\n`;
            controller.enqueue(encoder.encode(updateMessage));

            // Close stream if task is completed
            if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
              const endMessage = `data: ${JSON.stringify({
                type: 'stream_end',
                task_id: taskId,
                final_status: updatedTask.status,
                timestamp: new Date().toISOString(),
              })}\n\n`;
              controller.enqueue(encoder.encode(endMessage));
              controller.close();
              clearInterval(pollInterval);
            }
          } catch (error) {
            console.error(`[TASK-STREAM] Error polling task ${taskId}:`, error);
            const errorMessage = `data: ${JSON.stringify({
              type: 'error',
              task_id: taskId,
              error: 'Failed to fetch task updates',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            controller.enqueue(encoder.encode(errorMessage));
            controller.close();
            clearInterval(pollInterval);
          }
        }, 1000); // Poll every second

        // Clean up on stream close
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          controller.close();
        });

        // Send heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (!request.signal.aborted) {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            controller.enqueue(encoder.encode(heartbeat));
          } else {
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Every 30 seconds

        // Clean up heartbeat on stream close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval);
        });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    console.error('Error in task stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}