/**
 * Task DTOs
 *
 * Data Transfer Objects for task domain operations.
 * Uses primitives at boundaries, Value Objects used internally by application services.
 */

import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';

// Re-export response DTO from mapper to avoid duplication
export type { TaskDTO } from '@/app/mappers/task-mapper';

/**
 * DTO for creating a new task
 */
export interface CreateTaskDTO {
  agentId?: number;           // Optional - for direct agent assignment
  teamId?: number;            // Optional - for team assignment (mutually exclusive with agentId)
  name: string;
  instructions: TaskInstructions;
  skillId?: number;           // Optional - execute this skill instead of raw instructions
  chatMessageId?: string;     // Optional - link to ChatMessage for ExecutionSteps
  createdBy?: string;
  organizationId: number;
  // Trigger context for audit trail
  triggerType?: string;           // 'manual' | 'webhook' | 'database_event' | 'calendar' | 'public_api'
  triggeredByUserId?: string;     // Root-cause user who initiated the trigger chain
  triggeredByUserName?: string;   // Display name of triggering user
}

/**
 * DTO for executing a task
 */
export interface ExecuteTaskDTO {
  taskId: string;
  timeoutSeconds?: number;
}

/**
 * DTO for task execution result
 */
export interface TaskExecutionResultDTO {
  task: import('@/app/mappers/task-mapper').TaskDTO;
  executionResult: {
    success: boolean;
    executionId: string;
    status: string;
    outputData?: any;
    error?: string;
  };
}

/**
 * DTO for getting tasks with filters
 */
export interface GetTasksDTO {
  agentId?: number;
  organizationId: number;
  limit?: number;
}

/**
 * DTO for task statistics
 */
export interface TaskStatsDTO {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
  timeout: number;
}
