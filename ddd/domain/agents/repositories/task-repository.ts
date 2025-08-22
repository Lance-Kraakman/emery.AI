/**
 * Task Repository Interface
 * 
 * Domain contract for task data access operations.
 * Handles persistence of task entities and their lifecycle.
 * 
 * AIDEV-NOTE: Repository interface for task management - follows same pattern
 * as other domain repositories (agents, rag, etc.)
 */

import type { Task } from '../entities/task';

export interface ITaskRepository {
  /**
   * Find task by ID
   */
  findById(id: string): Promise<Task | null>;

  /**
   * Find tasks by agent ID
   */
  findByAgentId(agentId: number): Promise<Task[]>;

  /**
   * Find tasks by organization ID
   */
  findByOrganizationId(organizationId: number): Promise<Task[]>;

  /**
   * Find pending tasks (for scheduler processing)
   */
  findPendingTasks(limit?: number): Promise<Task[]>;

  /**
   * Find running tasks (for monitoring)
   */
  findRunningTasks(): Promise<Task[]>;

  /**
   * Find tasks by status
   */
  findByStatus(status: string, organizationId?: number): Promise<Task[]>;

  /**
   * Save task (create or update)
   */
  save(task: Task): Promise<void>;

  /**
   * Delete task
   */
  delete(id: string): Promise<void>;

  /**
   * Count tasks by status for organization
   */
  countByStatus(status: string, organizationId: number): Promise<number>;

  /**
   * Find recent tasks for organization (for dashboard)
   */
  findRecentByOrganization(organizationId: number, limit?: number): Promise<Task[]>;
}