/**
 * Drizzle Task Repository Implementation
 * 
 * Implements task persistence using Drizzle ORM with the existing tasks table
 */

import { eq, and, lt, lte, desc, asc, sql, or, isNull } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { DbClient } from '@/src/lib/db/client';
import { tasks } from '@/src/lib/db/schema';
import type { ITaskRepository, CreateTaskData, UpdateTaskData } from '@/src/ddd/domain/tasks/repositories/task-repository';
import { Task } from '@/src/ddd/domain/tasks/entities/task';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import { TaskId } from '@/src/ddd/domain/tasks/value-objects/task-id';
import { TaskStatus, TASK_STATUS } from '@/src/ddd/domain/tasks/value-objects/task-status';
import { AgentId, OrganizationId, UserId } from '@/src/ddd/domain/shared/value-objects';

type TaskRow = InferSelectModel<typeof tasks>;

export class DrizzleTaskRepository
  extends DrizzleBaseRepository<Task, TaskId, CreateTaskData, UpdateTaskData, TaskRow>
  implements ITaskRepository {
  
  protected readonly table = tasks;
  protected readonly idColumn = tasks.id;
  protected readonly organizationColumn = tasks.organizationId;

  async create(data: CreateTaskData): Promise<Task> {
    const [record] = await this.db
      .insert(tasks)
      .values({
        id: data.id || crypto.randomUUID(),
        agentId: data.agentId,
        organizationId: data.organizationId,
        name: data.name,
        capabilityName: data.capabilityName,
        instructions: data.instructions,
        status: data.status || 'pending',
        result: data.result,
        error: data.error,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        createdBy: data.createdBy,
        createdAt: data.createdAt || new Date()
      })
      .returning();
    
    return this.fromPersistence(record);
  }
  
  async update(id: TaskId, data: UpdateTaskData): Promise<Task> {
    const [record] = await this.db
      .update(tasks)
      .set(data)
      .where(eq(tasks.id, id.value))
      .returning();
    
    if (!record) {
      throw new Error(`Task with id ${id.value} not found`);
    }
    
    return this.fromPersistence(record);
  }

  // Inherits findById from base class
  // Inherits findByOrganization from base class
  // Inherits delete from base class

  async findByAgentId(agentId: AgentId): Promise<Task[]> {
    const results = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.agentId, agentId.value))
      .orderBy(desc(tasks.createdAt));

    return results.map((r: TaskRow) => this.fromPersistence(r));
  }

  // Legacy save method - kept for backward compatibility during transition
  async save(task: Task): Promise<void> {
    const data = task.toPersistence();
    
    if (data.id) {
      // Update existing task
      await this.db
        .update(tasks)
        .set(data)
        .where(eq(tasks.id, data.id));
    } else {
      // Insert new task
      await this.db.insert(tasks).values({
        ...data,
        id: crypto.randomUUID()
      });
    }
  }

  async findPendingTasks(limit?: number): Promise<Task[]> {
    const queryBuilder = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, TASK_STATUS.PENDING))
      .orderBy(asc(tasks.createdAt));

    const results = limit 
      ? await queryBuilder.limit(limit)
      : await queryBuilder;
    return results.map((r: TaskRow) => this.fromPersistence(r));
  }

  async findReadyForExecution(before?: Date): Promise<Task[]> {
    const cutoff = before || new Date();
    const results = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.PENDING),
          or(
            isNull(tasks.startedAt),
            lte(tasks.createdAt, cutoff)
          )
        )
      )
      .orderBy(asc(tasks.createdAt));

    return results.map((r: TaskRow) => this.fromPersistence(r));
  }

  async findByStatus(status: TaskStatus, limit?: number): Promise<Task[]> {
    const queryBuilder = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, status.value))
      .orderBy(desc(tasks.createdAt));

    const results = limit 
      ? await queryBuilder.limit(limit)
      : await queryBuilder;
    return results.map((r: TaskRow) => this.fromPersistence(r));
  }

  async findScheduledTasksDue(before?: Date): Promise<Task[]> {
    const cutoff = before || new Date();
    const results = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.PENDING),
          isNull(tasks.startedAt),
          lte(tasks.createdAt, cutoff)
        )
      )
      .orderBy(asc(tasks.createdAt));

    return results.map((r: TaskRow) => this.fromPersistence(r));
  }

  async saveMultiple(taskEntities: Task[]): Promise<void> {
    if (taskEntities.length === 0) return;

    const data = taskEntities.map(task => task.toPersistence());
    await this.db.insert(tasks).values(data);
  }

  async updateStatus(id: TaskId, status: TaskStatus): Promise<void> {
    await this.db
      .update(tasks)
      .set({ status: status.value })
      .where(eq(tasks.id, id.value));
  }

  async getTaskStats(): Promise<{
    totalTasks: number;
    tasksByStatus: Record<string, number>;
    averageExecutionTime: number;
    successRate: number;
  }> {
    // Get total count
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tasks);
    const totalTasks = totalResult[0]?.count || 0;

    // Get tasks by status
    const statusResult = await this.db
      .select({
        status: tasks.status,
        count: sql<number>`count(*)`
      })
      .from(tasks)
      .groupBy(tasks.status);

    const tasksByStatus: Record<string, number> = {};
    statusResult.forEach((row: { status: string; count: number }) => {
      tasksByStatus[row.status] = row.count;
    });

    // Calculate success rate and average execution time
    const completedTasks = tasksByStatus[TASK_STATUS.COMPLETED] || 0;
    const failedTasks = tasksByStatus[TASK_STATUS.FAILED] || 0;
    const successRate = completedTasks + failedTasks > 0 
      ? (completedTasks / (completedTasks + failedTasks)) * 100 
      : 0;

    // Average execution time for completed tasks
    const avgTimeResult = await this.db
      .select({
        avgTime: sql<number>`avg(extract(epoch from (completed_at - started_at)))`
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.COMPLETED),
          isNull(tasks.startedAt),
          isNull(tasks.completedAt)
        )
      );

    const averageExecutionTime = avgTimeResult[0]?.avgTime || 0;

    return {
      totalTasks,
      tasksByStatus,
      averageExecutionTime,
      successRate
    };
  }

  async deleteCompletedOlderThan(cutoffDate: Date): Promise<number> {
    await this.db
      .delete(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.COMPLETED),
          lt(tasks.completedAt, cutoffDate)
        )
      );

    return 0; // Return count not available in this Drizzle version
  }

  async deleteFailedOlderThan(cutoffDate: Date): Promise<number> {
    await this.db
      .delete(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.FAILED),
          lt(tasks.createdAt, cutoffDate)
        )
      );

    return 0; // Return count not available in this Drizzle version
  }

  protected fromPersistence(record: TaskRow): Task {
    return Task.fromPersistence({
      id: record.id,
      agentId: record.agentId,
      organizationId: record.organizationId,
      name: record.name,
      capabilityName: record.capabilityName,
      instructions: record.instructions,
      status: record.status,
      result: record.result,
      error: record.error,
      logs: record.logs,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdBy: record.createdBy,
      createdAt: record.createdAt || new Date()
    });
  }
  
  protected toPersistence(task: Task): any {
    return task.toPersistence();
  }
}