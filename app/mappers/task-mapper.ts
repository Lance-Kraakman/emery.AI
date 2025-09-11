/**
 * Task Domain-to-DTO Mapper
 * 
 * Maps between Task domain entity and frontend-compatible DTOs.
 * Handles conversion from Value Objects to serializable primitives.
 */

import type { Task as TaskEntity, TaskInstructions } from '@/ddd/domain/tasks/entities/task';

// DTO representing a task as returned by server actions to the frontend
export interface TaskDTO {
  id: string;
  agentId: number;                    // Converted from AgentId value object
  organizationId: number;             // Converted from OrganizationId value object
  name: string;
  capabilityName: string | null;
  instructions: TaskInstructions;
  status: string;                     // Converted from TaskStatus value object
  result: any;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdBy: string | null;           // Converted from UserId value object
  createdAt: Date;
}

/**
 * Convert Task domain entity to frontend DTO
 */
export function taskToDTO(task: TaskEntity): TaskDTO {
  return {
    id: task.id.value,
    agentId: task.agentId.value,
    organizationId: task.organizationId.value,
    name: task.name,
    capabilityName: task.capabilityName,
    instructions: task.instructions,
    status: task.status.value,
    result: task.result,
    error: task.error,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    createdBy: task.createdBy?.value || null,
    createdAt: task.createdAt
  };
}

/**
 * Convert multiple Task domain entities to frontend DTOs
 */
export function tasksToDTO(tasks: TaskEntity[]): TaskDTO[] {
  return tasks.map(taskToDTO);
}