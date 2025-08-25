/**
 * Drizzle Task Repository Implementation
 * 
 * Concrete implementation of ITaskRepository using Drizzle ORM.
 * Handles task persistence with the tasks table.
 * 
 * AIDEV-NOTE: Infrastructure implementation of task repository - handles
 * database operations and mapping between domain entities and database records
 */

import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { eq, desc, asc, inArray, and } from 'drizzle-orm';
import type { ITaskRepository } from '@/ddd/domain/agents/repositories/task-repository';
import { Task } from '@/ddd/domain/agents/entities/task';
import { TaskId, AgentId, OrganizationId, UserId, TaskStatus } from '@/ddd/domain/shared/value-objects';

export class DrizzleTaskRepository implements ITaskRepository {
  
  /**
   * Find task by ID
   */
  async findById(id: TaskId): Promise<Task | null> {
    const [taskRecord] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id.value))
      .limit(1);
    
    return taskRecord ? this.mapToEntity(taskRecord) : null;
  }

  /**
   * Find tasks by agent ID
   */
  async findByAgentId(agentId: AgentId): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.agentId, agentId.value))
      .orderBy(desc(tasks.createdAt));
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Find tasks by organization ID
   */
  async findByOrganizationId(organizationId: OrganizationId): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId.value))
      .orderBy(desc(tasks.createdAt));
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Find pending tasks (for scheduler processing)
   */
  async findPendingTasks(limit: number = 50): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'pending'))
      .orderBy(asc(tasks.createdAt)) // Oldest first for FIFO processing
      .limit(limit);
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Find running tasks (for monitoring)
   */
  async findRunningTasks(): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, 'in_progress'))
      .orderBy(asc(tasks.startedAt));
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Find tasks by status
   */
  async findByStatus(status: string, organizationId?: OrganizationId): Promise<Task[]> {
    const whereConditions = [eq(tasks.status, status)];
    
    if (organizationId) {
      whereConditions.push(eq(tasks.organizationId, organizationId.value));
    }
    
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(and(...whereConditions))
      .orderBy(desc(tasks.createdAt));
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Save task (create or update)
   */
  async save(task: Task): Promise<void> {
    const taskData = this.mapToDatabase(task);
    
    // AIDEV-DEBUG: Log the task data being saved to debug organization_id issue
    console.log('[TASK-REPOSITORY] Saving task data:', {
      id: taskData.id,
      agentId: taskData.agentId, 
      organizationId: taskData.organizationId,
      name: taskData.name,
      organizationIdType: typeof taskData.organizationId,
      organizationIdValue: taskData.organizationId
    });
    
    // Try to update first, then insert if not found
    const [existingTask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, task.id.value))
      .limit(1);
    
    if (existingTask) {
      // Update existing task
      await db
        .update(tasks)
        .set({
          name: taskData.name,
          capabilityName: taskData.capabilityName,
          instructions: taskData.instructions,
          status: taskData.status,
          result: taskData.result,
          error: taskData.error,
          startedAt: taskData.startedAt,
          completedAt: taskData.completedAt,
        })
        .where(eq(tasks.id, task.id.value));
    } else {
      // Insert new task
      await db.insert(tasks).values(taskData);
    }
  }

  /**
   * Delete task
   */
  async delete(id: TaskId): Promise<void> {
    await db
      .delete(tasks)
      .where(eq(tasks.id, id.value));
  }

  /**
   * Count tasks by status for organization
   */
  async countByStatus(status: string, organizationId: OrganizationId): Promise<number> {
    const [result] = await db
      .select({ count: db.$count(tasks) })
      .from(tasks)
      .where(and(
        eq(tasks.status, status),
        eq(tasks.organizationId, organizationId.value)
      ));
    
    return result?.count || 0;
  }

  /**
   * Find recent tasks for organization (for dashboard)
   */
  async findRecentByOrganization(organizationId: OrganizationId, limit: number = 20): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId.value))
      .orderBy(desc(tasks.createdAt))
      .limit(limit);
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Map database record to domain entity
   */
  private mapToEntity(record: any): Task {
    return Task.fromPersistence({
      id: record.id,
      agentId: record.agentId,
      organizationId: record.organizationId,
      name: record.name,
      capabilityName: record.capabilityName,
      instructions: record.instructions, // JSONB from database
      status: record.status,
      result: record.result,
      error: record.error,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    });
  }

  /**
   * Map domain entity to database record (Value Objects to primitives)
   * AIDEV-NOTE: Boundary conversion - converts Value Objects to database primitives
   */
  private mapToDatabase(task: Task) {
    const mapped = {
      id: task.id.value,
      agentId: task.agentId.value,
      organizationId: task.organizationId.value,
      name: task.name,
      capabilityName: task.capabilityName,
      instructions: task.instructions, // Will be stored as JSONB
      status: task.status.value,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdBy: task.createdBy?.value || null,
      createdAt: task.createdAt,
    };
    
    // AIDEV-DEBUG: Log the mapped data to debug organization_id issue
    console.log('[TASK-REPOSITORY] mapToDatabase result:', {
      id: mapped.id,
      agentId: mapped.agentId,
      organizationId: mapped.organizationId,
      organizationIdType: typeof mapped.organizationId,
      organizationIdIsNull: mapped.organizationId === null,
      organizationIdIsUndefined: mapped.organizationId === undefined,
      allKeys: Object.keys(mapped)
    });
    
    return mapped;
  }
}