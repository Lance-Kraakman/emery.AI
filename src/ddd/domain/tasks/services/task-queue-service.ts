/**
 * Task Queue Service
 * 
 * Domain service for managing task execution queue with priority and retry logic.
 * Replaces MemoryDispatchEventRepository with proper domain service pattern.
 * 
 * AIDEV-NOTE: This is a domain service that manages in-memory task queues
 * while using the persistent task repository for durability.
 */

import { Task } from '../entities/task';
import { TaskId } from '../value-objects/task-id';
import { TaskStatus, TASK_STATUS } from '../value-objects/task-status';
import type { AgentId } from '@/ddd/domain/shared/value-objects';

export interface TaskQueueConfig {
  maxConcurrentTasks?: number;
  retryDelayMs?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface QueuedTask {
  task: Task;
  priority: number;
  retryCount: number;
  lastAttempt: Date | null;
  nextRetry: Date | null;
}

/**
 * Domain service for managing task execution queue
 */
export interface ITaskQueueService {
  /**
   * Add task to execution queue
   */
  enqueue(task: Task, priority?: number): Promise<void>;

  /**
   * Get next ready tasks for execution
   */
  getReadyTasks(limit?: number): Promise<Task[]>;

  /**
   * Mark task as started
   */
  markTaskStarted(taskId: TaskId): Promise<void>;

  /**
   * Mark task as completed
   */
  markTaskCompleted(taskId: TaskId, result?: any): Promise<void>;

  /**
   * Mark task as failed and schedule retry if applicable
   */
  markTaskFailed(taskId: TaskId, error: string): Promise<void>;

  /**
   * Get tasks that have timed out
   */
  getTimedOutTasks(): Promise<Task[]>;

  /**
   * Get retry-able failed tasks
   */
  getRetryableTasks(limit?: number): Promise<Task[]>;

  /**
   * Get queue statistics
   */
  getQueueStats(): Promise<{
    totalQueued: number;
    processing: number;
    pendingRetry: number;
    averageWaitTime: number;
  }>;

  /**
   * Clear completed tasks from queue
   */
  clearCompleted(): Promise<number>;
}

export class TaskQueueService implements ITaskQueueService {
  private queuedTasks = new Map<string, QueuedTask>();
  private processingTasks = new Set<string>();
  
  constructor(private config: TaskQueueConfig = {}) {
    this.config = {
      maxConcurrentTasks: 10,
      retryDelayMs: 30000, // 30 seconds
      maxRetries: 3,
      timeoutMs: 300000, // 5 minutes
      ...config
    };
  }

  async enqueue(task: Task, priority: number = 1): Promise<void> {
    const queuedTask: QueuedTask = {
      task,
      priority,
      retryCount: 0,
      lastAttempt: null,
      nextRetry: null
    };

    this.queuedTasks.set(task.id.value, queuedTask);
  }

  async getReadyTasks(limit?: number): Promise<Task[]> {
    const now = new Date();
    const readyTasks: QueuedTask[] = [];

    for (const queuedTask of this.queuedTasks.values()) {
      const { task } = queuedTask;
      
      // Skip if task is not pending or already processing
      if (!task.isPending || this.processingTasks.has(task.id.value)) {
        continue;
      }

      // Skip if task is scheduled for later (check metadata)
      const scheduledFor = task.instructions.metadata?.scheduled_for;
      if (scheduledFor && new Date(scheduledFor) > now) {
        continue;
      }

      // Skip if task is waiting for retry delay
      if (queuedTask.nextRetry && queuedTask.nextRetry > now) {
        continue;
      }

      readyTasks.push(queuedTask);
    }

    // Sort by priority (higher first), then by creation time (older first)
    readyTasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.task.createdAt.getTime() - b.task.createdAt.getTime();
    });

    const maxTasks = Math.min(
      limit || this.config.maxConcurrentTasks!,
      this.config.maxConcurrentTasks! - this.processingTasks.size
    );

    return readyTasks.slice(0, maxTasks).map(qt => qt.task);
  }

  async markTaskStarted(taskId: TaskId): Promise<void> {
    const queuedTask = this.queuedTasks.get(taskId.value);
    if (queuedTask) {
      queuedTask.lastAttempt = new Date();
      this.processingTasks.add(taskId.value);
    }
  }

  async markTaskCompleted(taskId: TaskId, result?: any): Promise<void> {
    this.processingTasks.delete(taskId.value);
    this.queuedTasks.delete(taskId.value);
  }

  async markTaskFailed(taskId: TaskId, error: string): Promise<void> {
    this.processingTasks.delete(taskId.value);
    
    const queuedTask = this.queuedTasks.get(taskId.value);
    if (queuedTask) {
      queuedTask.retryCount++;
      
      // Schedule retry if we haven't exceeded max retries
      if (queuedTask.retryCount <= this.config.maxRetries!) {
        const retryDelay = this.calculateRetryDelay(queuedTask.retryCount);
        queuedTask.nextRetry = new Date(Date.now() + retryDelay);
      } else {
        // Remove from queue if max retries exceeded
        this.queuedTasks.delete(taskId.value);
      }
    }
  }

  async getTimedOutTasks(): Promise<Task[]> {
    const now = new Date();
    const timedOutTasks: Task[] = [];
    
    for (const taskId of this.processingTasks) {
      const queuedTask = this.queuedTasks.get(taskId);
      if (queuedTask && queuedTask.lastAttempt) {
        const timeSinceStart = now.getTime() - queuedTask.lastAttempt.getTime();
        if (timeSinceStart > this.config.timeoutMs!) {
          timedOutTasks.push(queuedTask.task);
        }
      }
    }

    return timedOutTasks;
  }

  async getRetryableTasks(limit?: number): Promise<Task[]> {
    const now = new Date();
    const retryableTasks: QueuedTask[] = [];

    for (const queuedTask of this.queuedTasks.values()) {
      if (queuedTask.retryCount > 0 && 
          queuedTask.nextRetry && 
          queuedTask.nextRetry <= now &&
          !this.processingTasks.has(queuedTask.task.id.value)) {
        retryableTasks.push(queuedTask);
      }
    }

    // Sort by retry count (fewer retries first)
    retryableTasks.sort((a, b) => a.retryCount - b.retryCount);

    return retryableTasks
      .slice(0, limit)
      .map(qt => qt.task);
  }

  async getQueueStats(): Promise<{
    totalQueued: number;
    processing: number;
    pendingRetry: number;
    averageWaitTime: number;
  }> {
    const now = new Date();
    let totalWaitTime = 0;
    let pendingRetry = 0;

    for (const queuedTask of this.queuedTasks.values()) {
      // Calculate wait time for pending tasks
      if (queuedTask.task.isPending && !this.processingTasks.has(queuedTask.task.id.value)) {
        totalWaitTime += now.getTime() - queuedTask.task.createdAt.getTime();
      }

      // Count retry tasks
      if (queuedTask.retryCount > 0) {
        pendingRetry++;
      }
    }

    const queuedCount = this.queuedTasks.size - this.processingTasks.size;
    const averageWaitTime = queuedCount > 0 ? totalWaitTime / queuedCount : 0;

    return {
      totalQueued: queuedCount,
      processing: this.processingTasks.size,
      pendingRetry,
      averageWaitTime: Math.round(averageWaitTime)
    };
  }

  async clearCompleted(): Promise<number> {
    let clearedCount = 0;
    const toRemove: string[] = [];

    for (const [taskId, queuedTask] of this.queuedTasks.entries()) {
      if (queuedTask.task.isTerminal && !this.processingTasks.has(taskId)) {
        toRemove.push(taskId);
      }
    }

    for (const taskId of toRemove) {
      this.queuedTasks.delete(taskId);
      clearedCount++;
    }

    return clearedCount;
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 30s, 60s, 120s
    return this.config.retryDelayMs! * Math.pow(2, retryCount - 1);
  }
}