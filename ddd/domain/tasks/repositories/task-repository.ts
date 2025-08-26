/**
 * Task Repository Interface
 * 
 * Defines the contract for task persistence and retrieval
 */

import type { Task } from '../entities/task';
import type { TaskId } from '../value-objects/task-id';
import type { TaskStatus } from '../value-objects/task-status';
import type { AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface ITaskRepository {
  // Basic CRUD operations
  findById(id: TaskId): Promise<Task | null>;
  findByAgentId(agentId: AgentId): Promise<Task[]>;
  findByOrganization(organizationId: OrganizationId): Promise<Task[]>;
  save(task: Task): Promise<void>;
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