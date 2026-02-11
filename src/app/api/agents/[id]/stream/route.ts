import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/ddd/infrastructure/db/client';
import { tasks, agents } from '@/ddd/infrastructure/db/schema';
import { eq, desc } from 'drizzle-orm';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { validateUserApiKey, extractApiKeyFromHeader } from '@/lib/auth/user-api-keys';

const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

/**
 * Stream real-time agent updates via Server-Sent Events (SSE)
 *
 * Supports two authentication methods:
 * - Session auth (browser): Uses cookies from next-auth
 * - Bearer token (Tauri): Uses user API key in Authorization header
 *
 * Events:
 * - tasks_updated: Task list changed (new task, status change)
 * - lock_changed: Workspace lock state changed
 * - workspace_updated: Remote workspace version changed
 * - heartbeat: Keep-alive (every 30s)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const params = await context.params;

  try {
    // Try session auth first (browser), then Bearer token (Tauri)
    let userId: string | null = null;

    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    } else {
      // Try Bearer token auth
      const authHeader = request.headers.get('authorization');
      const apiKey = extractApiKeyFromHeader(authHeader);
      console.log('[AGENT-STREAM] Auth attempt - session:', !!session?.user?.id, 'authHeader:', !!authHeader, 'apiKey prefix:', apiKey?.substring(0, 10));
      if (apiKey) {
        const userInfo = await validateUserApiKey(apiKey);
        console.log('[AGENT-STREAM] API key validation result:', !!userInfo);
        if (userInfo) {
          userId = userInfo.id;
        }
      }
    }

    if (!userId) {
      console.log('[AGENT-STREAM] Auth failed - no userId');
      return new Response('Unauthorized', { status: 401 });
    }

    const agentId = parseInt(params.id);
    if (isNaN(agentId)) {
      return new Response('Invalid agent ID', { status: 400 });
    }

    // Verify agent exists and user has access
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return new Response('Agent not found', { status: 404 });
    }

    // Verify agent ownership
    if (agent.ownerId !== userId) {
      return new Response('Access denied', { status: 403 });
    }

    // Get workspace path for this agent
    const workspacePath = join(WORKSPACE_BASE, String(agent.organizationId), 'agents', String(agentId));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Track state for change detection
        let lastTasksHash = '';
        let lastLockState: boolean | null = null;
        let lastSyncVersion: string | null = null;

        const sendEvent = (type: string, data: unknown) => {
          const event = {
            type,
            timestamp: new Date().toISOString(),
            data,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        // Helper to compute simple hash for change detection
        const hashTasks = (taskList: typeof tasks.$inferSelect[]) => {
          return JSON.stringify(taskList.map((t) => ({
            id: t.id,
            status: t.status,
            completedAt: t.completedAt,
            startedAt: t.startedAt,
          })));
        };

        // Check lock file exists
        const checkLockFile = async (): Promise<boolean> => {
          try {
            await access(join(workspacePath, '.emery-lock'));
            return true;
          } catch {
            return false;
          }
        };

        // Read sync version
        const getSyncVersion = async (): Promise<string | null> => {
          try {
            const content = await readFile(join(workspacePath, '.emery-sync-version'), 'utf-8');
            return content.trim();
          } catch {
            return null;
          }
        };

        // Initial state fetch and send
        const fetchAndSendInitialState = async () => {
          // Fetch tasks
          const taskList = await db
            .select()
            .from(tasks)
            .where(eq(tasks.agentId, agentId))
            .orderBy(desc(tasks.createdAt))
            .limit(50);

          lastTasksHash = hashTasks(taskList);
          sendEvent('tasks_snapshot', taskList);

          // Check lock state
          lastLockState = await checkLockFile();
          sendEvent('lock_changed', { locked: lastLockState });

          // Check sync version
          lastSyncVersion = await getSyncVersion();
          if (lastSyncVersion) {
            sendEvent('workspace_updated', { version: lastSyncVersion });
          }
        };

        // Send initial state
        await fetchAndSendInitialState();

        // Poll for changes
        const pollInterval = setInterval(async () => {
          try {
            // Check tasks for changes
            const taskList = await db
              .select()
              .from(tasks)
              .where(eq(tasks.agentId, agentId))
              .orderBy(desc(tasks.createdAt))
              .limit(50);

            const currentHash = hashTasks(taskList);
            if (currentHash !== lastTasksHash) {
              lastTasksHash = currentHash;
              sendEvent('tasks_updated', taskList);
            }

            // Check lock state
            const currentLockState = await checkLockFile();
            if (currentLockState !== lastLockState) {
              lastLockState = currentLockState;
              sendEvent('lock_changed', { locked: currentLockState });
            }

            // Check sync version
            const currentSyncVersion = await getSyncVersion();
            if (currentSyncVersion !== lastSyncVersion) {
              lastSyncVersion = currentSyncVersion;
              sendEvent('workspace_updated', { version: currentSyncVersion });
            }
          } catch (error) {
            console.error(`[AGENT-STREAM] Error polling agent ${agentId}:`, error);
          }
        }, 1000); // Poll every second

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          if (!request.signal.aborted) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }
        }, 30000);

        // Clean up on abort
        request.signal.addEventListener('abort', () => {
          clearInterval(pollInterval);
          clearInterval(heartbeatInterval);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in agent stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
