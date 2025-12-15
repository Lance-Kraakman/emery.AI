/**
 * Task Repository Interface
 * 
 * Defines the contract for task persistence and retrieval
 */

import type { Task } from '../entities/task';
import type { TaskId } from '../value-objects/task-id';
import type { TaskStatus } from '../value-objects/task-status';
import type { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Data transfer objects for repository operations
export interface CreateTaskData {
  id?: string;
  agentId: number;
  organizationId: number;
  name: string;
  skillId?: number | null; // Optional skill to execute
  instructions: any; // JSONB from database
  triggerContext?: any; // JSONB trigger context
  status?: string;
  result?: any;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdBy?: string | null;
  createdAt?: Date;
}

export interface UpdateTaskData {
  status?: string;
  result?: any;
  error?: string | null;
  logs?: string[];
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface ITaskRepository {
  // Basic CRUD operations
  create(data: CreateTaskData): Promise<Task>;
  update(id: TaskId, data: UpdateTaskData): Promise<Task>;
  findById(id: TaskId): Promise<Task | null>;
  findByAgentId(agentId: AgentId): Promise<Task[]>;
  findByOrganization(organizationId: OrganizationId): Promise<Task[]>;
  delete(id: TaskId): Promise<void>;
  
  // Scheduling-specific queries
  findPendingTasks(limit?: number): Promise<Task[]>;
  findReadyForExecution(before?: Date): Promise<Task[]>;
  findByStatus(status: TaskStatus, limit?: number): Promise<Task[]>;
  findScheduledTasksDue(before?: Date): Promise<Task[]>;
  
  // Bulk operations
  saveMultiple(tasks: Task[]): Promise<void>;
  updateStatus(id: TaskId, status: TaskStatus): Promise<void>;
  
  // Statistics and monitoring
  getTaskStats(): Promise<{
    totalTasks: number;
    tasksByStatus: Record<string, number>;
    averageExecutionTime: number;
    successRate: number;
  }>;
  
  // Cleanup operations
  deleteCompletedOlderThan(cutoffDate: Date): Promise<number>;
  deleteFailedOlderThan(cutoffDate: Date): Promise<number>;
}