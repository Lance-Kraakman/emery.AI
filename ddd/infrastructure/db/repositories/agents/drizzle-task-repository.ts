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

export class DrizzleTaskRepository implements ITaskRepository {
  
  /**
   * Find task by ID
   */
  async findById(id: string): Promise<Task | null> {
    const [taskRecord] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    
    return taskRecord ? this.mapToEntity(taskRecord) : null;
  }

  /**
   * Find tasks by agent ID
   */
  async findByAgentId(agentId: number): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.agentId, agentId))
      .orderBy(desc(tasks.createdAt));
    
    return taskRecords.map(record => this.mapToEntity(record));
  }

  /**
   * Find tasks by organization ID
   */
  async findByOrganizationId(organizationId: number): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId))
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
  async findByStatus(status: string, organizationId?: number): Promise<Task[]> {
    const whereConditions = [eq(tasks.status, status)];
    
    if (organizationId) {
      whereConditions.push(eq(tasks.organizationId, organizationId));
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
    
    // Try to update first, then insert if not found
    const [existingTask] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, task.id))
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
        .where(eq(tasks.id, task.id));
    } else {
      // Insert new task
      await db.insert(tasks).values(taskData);
    }
  }

  /**
   * Delete task
   */
  async delete(id: string): Promise<void> {
    await db
      .delete(tasks)
      .where(eq(tasks.id, id));
  }

  /**
   * Count tasks by status for organization
   */
  async countByStatus(status: string, organizationId: number): Promise<number> {
    const [result] = await db
      .select({ count: db.$count(tasks) })
      .from(tasks)
      .where(and(
        eq(tasks.status, status),
        eq(tasks.organizationId, organizationId)
      ));
    
    return result?.count || 0;
  }

  /**
   * Find recent tasks for organization (for dashboard)
   */
  async findRecentByOrganization(organizationId: number, limit: number = 20): Promise<Task[]> {
    const taskRecords = await db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId))
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
   * Map domain entity to database record
   */
  private mapToDatabase(task: Task) {
    return {
      id: task.id,
      agentId: task.agentId,
      organizationId: task.organizationId,
      name: task.name,
      capabilityName: task.capabilityName,
      instructions: task.instructions, // Will be stored as JSONB
      status: task.status,
      result: task.result,
      error: task.error,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
    };
  }
}