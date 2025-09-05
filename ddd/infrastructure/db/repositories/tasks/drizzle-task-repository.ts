/**
 * Drizzle Task Repository Implementation
 * 
 * Implements task persistence using Drizzle ORM with the existing tasks table
 */

import { eq, and, lt, lte, desc, asc, sql, or, isNull } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import { Task } from '@/ddd/domain/tasks/entities/task';
import { TaskId } from '@/ddd/domain/tasks/value-objects/task-id';
import { TaskStatus, TASK_STATUS } from '@/ddd/domain/tasks/value-objects/task-status';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export class DrizzleTaskRepository implements ITaskRepository {
  constructor(private db: DbClient) {}

  async findById(id: TaskId): Promise<Task | null> {
    const [result] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id.value))
      .limit(1);

    return result ? this.mapToEntity(result) : null;
  }

  async findByAgentId(agentId: AgentId): Promise<Task[]> {
    const results = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.agentId, agentId.value))
      .orderBy(desc(tasks.createdAt));

    return results.map(r => this.mapToEntity(r));
  }

  async findByOrganization(organizationId: OrganizationId): Promise<Task[]> {
    const results = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId.value))
      .orderBy(desc(tasks.createdAt));

    return results.map(r => this.mapToEntity(r));
  }

  async save(task: Task): Promise<void> {
    const data = this.mapToDb(task);
    
    // Check if task already exists by trying to find it
    const existing = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, task.id.value))
      .limit(1);
    
    if (existing.length === 0) {
      // New task - do a straight INSERT (should trigger database triggers)
      try {        
        await this.db
          .insert(tasks)
          .values(data);
        
        console.log(`[DRIZZLE-TASK-REPO] Successfully inserted task ${task.id.value.toString().substring(0, 8)}`);
      } catch (error) {
        console.error(`[DRIZZLE-TASK-REPO] Failed to insert task ${task.id.value.toString().substring(0, 8)}:`, error);
        
        // Check if this is an RLS policy violation
        if (error instanceof Error && (
          error.message.includes('permission denied') || 
          error.message.includes('policy violation') ||
          error.message.includes('insufficient privilege') ||
          error.message.includes('row level security') ||
          error.message.includes('RLS')
        )) {
          throw new Error(`Permission denied: You do not have permission to assign tasks to this agent`);
        }
        
        // Re-throw other database errors as-is
        throw error;
      }
    } else {
      // Existing task - do an UPDATE
      await this.db
        .update(tasks)
        .set({
          status: data.status,
          result: data.result,
          error: data.error,
          startedAt: data.startedAt,
          completedAt: data.completedAt
        })
        .where(eq(tasks.id, task.id.value));
    }
  }

  async delete(id: TaskId): Promise<void> {
    await this.db
      .delete(tasks)
      .where(eq(tasks.id, id.value));
  }

  async findPendingTasks(limit?: number): Promise<Task[]> {
    const baseQuery = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, TASK_STATUS.PENDING))
      .orderBy(asc(tasks.createdAt));

    const results = limit 
      ? await baseQuery.limit(limit)
      : await baseQuery;
      
    return results.map(r => this.mapToEntity(r));
  }

  async findReadyForExecution(before: Date = new Date()): Promise<Task[]> {
    // Tasks are ready if they are pending - scheduled timing is handled via metadata
    const results = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, TASK_STATUS.PENDING))
      .orderBy(asc(tasks.createdAt));

    return results.map(r => this.mapToEntity(r));
  }

  async findByStatus(status: TaskStatus, limit?: number): Promise<Task[]> {
    const baseQuery = this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, status.value))
      .orderBy(desc(tasks.createdAt));

    const results = limit 
      ? await baseQuery.limit(limit)
      : await baseQuery;
      
    return results.map(r => this.mapToEntity(r));
  }

  async findScheduledTasksDue(before: Date = new Date()): Promise<Task[]> {
    // All pending tasks - actual scheduling timing is handled in task queue service via metadata
    const results = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, TASK_STATUS.PENDING))
      .orderBy(asc(tasks.createdAt));

    return results.map(r => this.mapToEntity(r));
  }

  async saveMultiple(tasksToSave: Task[]): Promise<void> {
    if (tasksToSave.length === 0) return;

    const values = tasksToSave.map(task => this.mapToDb(task));
    
    await this.db
      .insert(tasks)
      .values(values)
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          status: sql`excluded.status`,
          result: sql`excluded.result`,
          error: sql`excluded.error`,
          startedAt: sql`excluded.started_at`,
          completedAt: sql`excluded.completed_at`
        }
      });
  }

  async updateStatus(id: TaskId, status: TaskStatus): Promise<void> {
    await this.db
      .update(tasks)
      .set({ 
        status: status.value
      })
      .where(eq(tasks.id, id.value));
  }

  async getTaskStats(): Promise<{
    totalTasks: number;
    tasksByStatus: Record<string, number>;
    averageExecutionTime: number;
    successRate: number;
  }> {
    // Get task counts by status
    const statusCounts = await this.db
      .select({
        status: tasks.status,
        count: sql<number>`COUNT(*)`
      })
      .from(tasks)
      .groupBy(tasks.status);

    const tasksByStatus: Record<string, number> = {};
    let totalTasks = 0;
    
    statusCounts.forEach(row => {
      tasksByStatus[row.status] = Number(row.count);
      totalTasks += Number(row.count);
    });

    // Calculate average execution time and success rate
    const stats = await this.db
      .select({
        avgExecutionTime: sql<number>`AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)`,
        successCount: sql<number>`COUNT(*) FILTER (WHERE status = ${TASK_STATUS.COMPLETED})`,
        totalCompleted: sql<number>`COUNT(*) FILTER (WHERE status IN (${TASK_STATUS.COMPLETED}, ${TASK_STATUS.FAILED}))`
      })
      .from(tasks)
      .where(sql`completed_at IS NOT NULL AND started_at IS NOT NULL`);

    const avgTime = stats[0]?.avgExecutionTime || 0;
    const successCount = Number(stats[0]?.successCount || 0);
    const totalCompleted = Number(stats[0]?.totalCompleted || 0);
    const successRate = totalCompleted > 0 ? (successCount / totalCompleted) * 100 : 0;

    return {
      totalTasks,
      tasksByStatus,
      averageExecutionTime: Math.round(avgTime),
      successRate: Math.round(successRate * 100) / 100
    };
  }

  async deleteCompletedOlderThan(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.COMPLETED),
          lt(tasks.completedAt!, cutoffDate)
        )
      );

    return result.count || 0;
  }

  async deleteFailedOlderThan(cutoffDate: Date): Promise<number> {
    const result = await this.db
      .delete(tasks)
      .where(
        and(
          eq(tasks.status, TASK_STATUS.FAILED),
          lt(tasks.completedAt!, cutoffDate)
        )
      );

    return result.count || 0;
  }

  private mapToEntity(row: any): Task {
    return Task.fromPersistence({
      id: row.id,
      agentId: row.agentId,
      organizationId: row.organizationId,
      name: row.name,
      capabilityName: row.capabilityName,
      instructions: row.instructions || {},
      status: row.status,
      result: row.result,
      error: row.error,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  }

  private mapToDb(task: Task): any {
    return {
      id: task.id.value,
      agentId: task.agentId.value,
      organizationId: task.organizationId.value,
      name: task.name,
      capabilityName: task.capabilityName || null,
      instructions: task.instructions,
      status: task.status.value,
      result: task.result || null,
      error: task.error || null,
      startedAt: task.startedAt || null,
      completedAt: task.completedAt || null,
      createdBy: task.createdBy?.value || null,
      createdAt: task.createdAt || new Date()
    };
  }
}