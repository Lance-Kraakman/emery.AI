/**
 * AIDEV-NOTE: Promptfoo custom provider for Emery task execution
 *
 * Creates and monitors tasks via:
 * - POST /api/tasks - Create task
 * - GET /api/tasks/[id] - Get task status
 *
 * Uses types from the main application for type safety.
 *
 * Environment variables:
 *   EMERY_BASE_URL - API base URL (e.g., http://localhost:3002)
 *   EMERY_API_KEY  - User API key (user_xxx format)
 *   TEST_AGENT_ID  - Default agent ID for tests
 */

import type { TaskDTO, TaskExecutionResultDTO } from '@app/app/dtos/task.dto';
import type { ApiSuccessResponse, ApiErrorResponse } from '@app/lib/api/base';

// Simplified instructions type for API requests (API accepts plain objects)
interface TaskInstructionsInput {
  task: string;
  tools?: Array<{ name: string; config?: Record<string, unknown> }>;
  metadata?: Record<string, unknown>;
}

// Provider context from promptfoo
interface ProviderContext {
  vars: {
    agentId?: string;
    taskName?: string;
    tools?: Array<{ name: string; version?: string; config?: Record<string, unknown> }>;
    metadata?: Record<string, unknown>;
    timeout?: number;
  };
}

// Provider response for promptfoo
interface ProviderResponse {
  output: TaskExecutionResultDTO | ApiErrorResponse | { success: boolean; error?: string };
  tokenUsage?: {
    total: number;
    prompt: number;
    completion: number;
  };
  error?: string;
}

// API response types
type TaskCreateResponse = ApiSuccessResponse<{ task: TaskDTO }>;
type TaskGetResponse = ApiSuccessResponse<{ task: TaskDTO }>;

const BASE_URL = process.env.EMERY_BASE_URL || 'http://localhost:3002';
const API_KEY = process.env.EMERY_API_KEY || '';
const DEFAULT_AGENT_ID = process.env.TEST_AGENT_ID || '1';
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Create a new task
 */
async function createTask(
  agentId: number,
  name: string,
  instructions: TaskInstructionsInput
): Promise<TaskCreateResponse | ApiErrorResponse> {
  const url = `${BASE_URL}/api/tasks`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId,
      name,
      instructions,
    }),
  });

  return response.json() as Promise<TaskCreateResponse | ApiErrorResponse>;
}

/**
 * Get task status
 */
async function getTask(taskId: string): Promise<TaskGetResponse | ApiErrorResponse> {
  const url = `${BASE_URL}/api/tasks/${taskId}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
  });

  return response.json() as Promise<TaskGetResponse | ApiErrorResponse>;
}

/**
 * Poll task status until complete or timeout
 */
async function waitForTaskCompletion(
  taskId: string,
  timeout: number
): Promise<TaskDTO> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await getTask(taskId);

    if (!('success' in result) || !result.success) {
      throw new Error('error' in result ? result.error : 'Failed to get task status');
    }

    const task = result.data.task;

    // Check if task is complete
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Task timed out');
}

/**
 * Main provider function called by promptfoo
 *
 * @param prompt - The task instruction to execute
 * @param context - Context with variables from the test
 */
export default async function executeTask(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse> {
  const { vars } = context;
  const agentId = parseInt(vars.agentId || DEFAULT_AGENT_ID);
  const timeout = vars.timeout || DEFAULT_TIMEOUT;

  try {
    // 1. Create the task
    const taskName = vars.taskName || `eval-${Date.now()}`;
    const instructions: TaskInstructionsInput = {
      task: prompt,
      tools: vars.tools?.map(t => ({
        name: t.name,
        config: t.config || {},
      })),
      metadata: {
        ...vars.metadata,
        evalRun: true,
      },
    };

    const createResult = await createTask(agentId, taskName, instructions);

    if (!('success' in createResult) || !createResult.success) {
      const error = 'error' in createResult ? createResult.error : 'Failed to create task';
      return {
        output: { success: false, error },
        error,
      };
    }

    const taskId = createResult.data.task.id;

    // 2. Wait for task completion
    const completedTask = await waitForTaskCompletion(taskId, timeout);

    return {
      output: {
        task: completedTask,
        executionResult: {
          success: completedTask.status === 'completed',
          executionId: taskId,
          status: completedTask.status,
          outputData: completedTask.result,
          error: completedTask.error || undefined,
        },
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      output: { success: false, error: errorMessage },
      error: errorMessage,
    };
  }
}
