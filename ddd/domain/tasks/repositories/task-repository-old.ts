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
import { TaskId, AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface ITaskRepository {
  /**
   * Find task by ID
   */
  findById(id: TaskId): Promise<Task | null>;

  /**
   * Find tasks by agent ID
   */
  findByAgentId(agentId: AgentId): Promise<Task[]>;

  /**
   * Find tasks by organization ID
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<Task[]>;

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
  findByStatus(status: string, organizationId?: OrganizationId): Promise<Task[]>;

  /**
   * Save task (create or update)
   */
  save(task: Task): Promise<void>;

  /**
   * Delete task
   */
  delete(id: TaskId): Promise<void>;

  /**
   * Count tasks by status for organization
   */
  countByStatus(status: string, organizationId: OrganizationId): Promise<number>;

  /**
   * Find recent tasks for organization (for dashboard)
   */
  findRecentByOrganization(organizationId: OrganizationId, limit?: number): Promise<Task[]>;
}