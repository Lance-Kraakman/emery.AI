/**
 * Task Scheduling Application Service
 * 
 * Orchestrates task scheduling and execution operations using domain services
 * and repositories. Coordinates between scheduler, task queue, and execution.
 * 
 * AIDEV-NOTE: This application service integrates with the existing agent-scheduler.ts system
 * and ragIndexingApplicationService for RAG index scheduling.
 */

import { Task, TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import { TaskId } from '@/ddd/domain/tasks/value-objects/task-id';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { ITaskQueueService, TaskQueueConfig } from '@/ddd/domain/tasks/services/task-queue-service';
import type { ISchedulerService } from '@/ddd/domain/tasks/services/scheduler-service';
import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export interface TaskExecutionRequest {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  priority?: number;
  scheduledFor?: Date;
  createdBy?: UserId;
}

export interface ScheduleTaskRequest {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  trigger: TriggerConfig;
}

/**
 * Application service for coordinating task scheduling and execution
 */
export class TaskSchedulingApplicationService {
  constructor(
    private taskRepository: ITaskRepository,
    private taskQueueService: ITaskQueueService,
    private schedulerService: ISchedulerService,
    private ragIndexingApplicationService?: any // Optional RAG indexing service
  ) {}

  /**
   * Execute a task immediately or schedule for later
   */
  async executeTask(request: TaskExecutionRequest): Promise<TaskId> {
    // Create task entity with scheduling info in metadata if provided
    const instructions = { ...request.instructions };
    if (request.scheduledFor) {
      instructions.metadata = {
        ...instructions.metadata,
        scheduled_for: request.scheduledFor.toISOString()
      };
    }

    const task = Task.create({
      agentId: request.agentId,
      organizationId: request.organizationId,
      name: request.name,
      capabilityName: request.capabilityName,
      instructions,
      createdBy: request.createdBy
    });

    // Persist task
    await this.taskRepository.save(task);

    // Add to execution queue
    await this.taskQueueService.enqueue(task, request.priority);

    return task.id;
  }

  /**
   * Process pending tasks (called by scheduler)
   */
  async processPendingTasks(limit: number = 10): Promise<{
    processed: number;
    failed: number;
    queued: number;
  }> {
    let processed = 0;
    let failed = 0;

    // 1. Check for scheduled tasks that are due
    const scheduledTasks = await this.schedulerService.getTasksDueForExecution();
    for (const task of scheduledTasks) {
      try {
        await this.taskRepository.save(task);
        await this.taskQueueService.enqueue(task, 1); // Normal priority for scheduled tasks
        processed++;
      } catch (error) {
        console.error(`Failed to queue scheduled task ${task.id.value}:`, error);
        failed++;
      }
    }

    // 2. Get ready tasks from queue
    const readyTasks = await this.taskQueueService.getReadyTasks(limit);
    
    // 3. Process ready tasks
    for (const task of readyTasks.slice(0, Math.max(0, limit - processed))) {
      try {
        await this.processTask(task);
        processed++;
      } catch (error) {
        console.error(`Failed to process task ${task.id.value}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        await this.taskQueueService.markTaskFailed(task.id, errorMessage);
        failed++;
      }
    }

    // 4. Handle timeouts
    const timedOutTasks = await this.taskQueueService.getTimedOutTasks();
    for (const task of timedOutTasks) {
      try {
        task.timeout();
        await this.taskRepository.save(task);
        await this.taskQueueService.markTaskFailed(task.id, 'Task execution timed out');
        failed++;
      } catch (error) {
        console.error(`Failed to handle timeout for task ${task.id.value}:`, error);
      }
    }

    // 5. Process retries
    const retryTasks = await this.taskQueueService.getRetryableTasks(3);
    for (const task of retryTasks) {
      try {
        await this.taskQueueService.enqueue(task, 2); // Higher priority for retries
      } catch (error) {
        console.error(`Failed to requeue retry task ${task.id.value}:`, error);
        failed++;
      }
    }

    const stats = await this.taskQueueService.getQueueStats();
    
    return {
      processed,
      failed,
      queued: stats.totalQueued
    };
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task): Promise<void> {
    // Mark as started
    task.start();
    await this.taskRepository.save(task);
    await this.taskQueueService.markTaskStarted(task.id);

    try {
      // This would integrate with the existing agent execution system
      // For now, simulate task processing
      const result = await this.executeAgentTask(task);
      
      // Mark as completed
      task.complete(result);
      await this.taskRepository.save(task);
      await this.taskQueueService.markTaskCompleted(task.id, result);

      // Update scheduler stats
      await this.schedulerService.updateNextExecution(task.agentId, true);
      
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      task.fail(errorMessage);
      await this.taskRepository.save(task);
      await this.taskQueueService.markTaskFailed(task.id, errorMessage);

      // Update scheduler stats
      await this.schedulerService.updateNextExecution(task.agentId, false);
    }
  }

  /**
   * Execute agent task - integrates with existing agent execution system
   */
  private async executeAgentTask(task: Task): Promise<any> {
    // This would integrate with the existing agent-scheduler.ts system
    // or directly call the agent execution logic
    
    // Placeholder implementation
    return {
      status: 'completed',
      message: `Task ${task.name} executed successfully`,
      executedAt: new Date().toISOString()
    };
  }

  /**
   * Get task execution statistics
   */
  async getExecutionStats(): Promise<{
    taskStats: any;
    queueStats: any;
    schedulerStats: any;
  }> {
    const [taskStats, queueStats, schedulerStats] = await Promise.all([
      this.taskRepository.getTaskStats(),
      this.taskQueueService.getQueueStats(),
      this.schedulerService.getSchedulerStats()
    ]);

    return {
      taskStats,
      queueStats,
      schedulerStats
    };
  }

  /**
   * Clean up completed tasks
   */
  async cleanup(olderThanDays: number = 7): Promise<{
    tasksDeleted: number;
    queueCleared: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const [tasksDeleted, queueCleared] = await Promise.all([
      this.taskRepository.deleteCompletedOlderThan(cutoffDate),
      this.taskQueueService.clearCompleted()
    ]);

    return {
      tasksDeleted,
      queueCleared
    };
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: TaskId): Promise<Task | null> {
    return await this.taskRepository.findById(taskId);
  }

  /**
   * Get tasks for agent
   */
  async getTasksForAgent(agentId: AgentId): Promise<Task[]> {
    return await this.taskRepository.findByAgentId(agentId);
  }

  /**
   * Get tasks for organization
   */
  async getTasksForOrganization(organizationId: OrganizationId): Promise<Task[]> {
    return await this.taskRepository.findByOrganization(organizationId);
  }

  /**
   * Cancel a pending task
   */
  async cancelTask(taskId: TaskId, reason?: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (task && !task.isTerminal) {
      task.cancel(reason);
      await this.taskRepository.save(task);
    }
  }
}