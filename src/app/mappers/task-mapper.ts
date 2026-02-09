/**
 * Task Domain-to-DTO Mapper
 * 
 * Maps between Task domain entity and frontend-compatible DTOs.
 * Handles conversion from Value Objects to serializable primitives.
 */

import type { Task as TaskEntity, TaskInstructions, TriggerContext, PendingHumanStep } from '@/ddd/domain/tasks/entities/task';

// DTO representing a task as returned by server actions to the frontend
export interface TaskDTO {
  id: string;
  agentId: number | null;             // null = org-level task, set = agent executes this
  organizationId: number;             // Converted from OrganizationId value object
  name: string;
  instructions: TaskInstructions;
  skillId: number | null;             // Optional skill to execute
  triggerContext: TriggerContext | null; // What triggered this task (schedule, manual, etc.)
  chatMessageId: string | null;       // Link to ChatMessage for ExecutionSteps
  status: string;                     // Converted from TaskStatus value object
  result: any;
  error: string | null;
  logs: string[];                     // Task execution logs
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: string | null;           // Converted from UserId value object
  createdAt: Date;
  // Human skill tracking
  currentStepId: string | null;       // Current step ID in workflow
  pendingHumanSteps: PendingHumanStep[]; // Pending human steps with inputs/outputs
}

/**
 * Convert Task domain entity to frontend DTO
 */
export function taskToDTO(task: TaskEntity): TaskDTO {
  return {
    id: task.id.value,
    agentId: task.agentId?.value ?? null, // Handle nullable agentId
    organizationId: task.organizationId.value,
    name: task.name,
    instructions: task.instructions,
    skillId: task.skillId,
    triggerContext: task.triggerContext,
    chatMessageId: task.chatMessageId,
    status: task.status.value,
    result: task.result,
    error: task.error,
    logs: task.logs,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    createdBy: task.createdBy?.value || null,
    createdAt: task.createdAt,
    currentStepId: task.currentStepId,
    pendingHumanSteps: task.pendingHumanSteps
  };
}

/**
 * Convert multiple Task domain entities to frontend DTOs
 */
export function tasksToDTO(tasks: TaskEntity[]): TaskDTO[] {
  return tasks.map(taskToDTO);
}