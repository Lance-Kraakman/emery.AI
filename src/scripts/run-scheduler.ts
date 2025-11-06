#!/usr/bin/env tsx

import { 
  getTaskRepository,
  getTaskQueueService,
  getSchedulerService,
  taskSchedulingContainer
} from "@/ddd/application/di/scheduling-container";
import {
  getAgentTaskApplicationService,
  initializeDI
} from "@/ddd/application/di/container";
import { createNotificationClient, rawClient } from "@/lib/db/client";
import { contextAwareDb } from "@/lib/db/simple-context-proxy";
import { withSystemContext } from "@/lib/db/system-context";
import { TaskId } from "@/ddd/domain/tasks/value-objects/task-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import type { TaskEvent } from "@/ddd/domain/scheduling";
import { DatabaseEventTriggerConfig, TriggerConfigFromJSON } from "@/ddd/domain/scheduling/value-objects/trigger-config";
import { getAgentRepository } from "@/ddd/application/di/container";
import postgres from "postgres";

/**
 * Event-Driven Scheduler
 * Listens to PostgreSQL events and orchestrates task execution
 */
class EventDrivenScheduler {
  private notificationClient: postgres.Sql | null = null;
  private isShuttingDown = false;
  private fallbackTimer: NodeJS.Timeout | null = null;

  constructor(
    private agentTaskService = getAgentTaskApplicationService(),
    private schedulerService = getSchedulerService(),
    private taskRepository = getTaskRepository(),
    private taskQueueService = getTaskQueueService()
  ) {}

  async start(): Promise<void> {
    console.log('🚀 Starting Event-Driven Scheduler...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

    try {
      // 1. Setup PostgreSQL event listeners
      await this.setupEventListeners();
      console.log('✅ PostgreSQL event listeners configured');

      // 2. Start fallback timer for scheduled tasks (30 second)
      this.startFallbackTimer();
      console.log('⏰ Fallback timer started (30 second intervals)');

      // 3. Process any existing queued tasks on startup
      await this.processQueuedTasks();
      console.log('📋 Initial queue processed');

      console.log('✅ Event-Driven Scheduler started successfully');
      console.log('🎧 Listening for task_event and rag_reindex_needed events...');

    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
      throw error;
    }
  }

  private async setupEventListeners(): Promise<void> {
    this.notificationClient = createNotificationClient();

    // Listen for task events (primarily MANUAL triggers via database)
    await this.notificationClient.listen('task_event', async (payload) => {
      try {
        const event = JSON.parse(payload);
        console.log(`📨 Received task_event: taskId=${event.taskId}`);
        await this.handleTaskEvent(event);
      } catch (error) {
        console.error('❌ Error handling task_event:', error);
      }
    });

    console.log('🎧 Listening for task_event...');
  }

  private async handleTaskEvent(event: TaskEvent): Promise<void> {
    return withSystemContext(event.organizationId, async () => {
      if (!event.taskId) {
        console.warn('⚠️ task_event missing taskId');
        return;
      }
      // This is a manual task execution
      const task = await this.taskRepository.findById(TaskId.fromString(event.taskId));
      if (task && task.isPending) {
        await this.agentTaskService.executeTask({ taskId: event.taskId });
        console.log(`✅ Processed task ${event.taskId}`);
      } else {
        console.log(`⏭️ Skipping task ${event.taskId} (not found or not pending)`);
      }
    });
  }

  private startFallbackTimer(): void {
    // Reduced frequency - 5 minutes instead of 30 seconds
    this.fallbackTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        // Process scheduled tasks (CALENDAR triggers)
        await this.processScheduledTasks();
        
        // Handle timeouts
        await this.processTimeouts();
        
        // Process retries
        await this.processRetries();
      } catch (error) {
        console.error('❌ Error in fallback timer:', error);
      }
    }, 300000); // 5 minutes
  }

  private async processScheduledTasks(): Promise<void> {
    // Handle CALENDAR triggers
    const dueTasks = await this.schedulerService.getTasksDueForExecution();
    
    if (dueTasks.length > 0) {
      console.log(`⏰ Processing ${dueTasks.length} scheduled tasks`);
      
      for (const task of dueTasks) {
        await withSystemContext(task.organizationId, async () => {
          try {
            const createData = {
              agentId: task.agentId.value,
              organizationId: task.organizationId.value,
              name: task.name,
              skillName: task.skillName,
              instructions: task.instructions,
              status: task.status.value,
              createdBy: task.createdBy?.value,
              createdAt: task.createdAt || new Date()
            };
            await this.taskRepository.create(createData);
            await this.agentTaskService.executeTask({ taskId: task.id.value });
          } catch (error) {
            console.error(`❌ Failed to process scheduled task ${task.id.value}:`, error);
          }
        });
      }
    }
  }

  private async processQueuedTasks(): Promise<void> {
    const readyTasks = await this.taskQueueService.getReadyTasks(10);
    
    for (const task of readyTasks) {
      await withSystemContext(task.organizationId, async () => {
        try {
          await this.agentTaskService.executeTask({ taskId: task.id.value });
        } catch (error) {
          console.error(`❌ Failed to process queued task ${task.id.value}:`, error);
        }
      });
    }
  }

  private async processTimeouts(): Promise<void> {
    const timedOutTasks = await this.taskQueueService.getTimedOutTasks();
    
    for (const task of timedOutTasks) {
      await withSystemContext(task.organizationId, async () => {
        try {
          task.timeout();
          await this.taskRepository.update(task.id, { status: task.status.value });
          await this.taskQueueService.markTaskFailed(task.id, 'Task execution timed out');
          console.log(`⏱️ Marked task ${task.id.value} as timed out`);
        } catch (error) {
          console.error(`❌ Failed to handle timeout for task ${task.id.value}:`, error);
        }
      });
    }
  }

  private async processRetries(): Promise<void> {
    const retryTasks = await this.taskQueueService.getRetryableTasks(3);
    
    for (const task of retryTasks) {
      await withSystemContext(task.organizationId, async () => {
        try {
          await this.taskQueueService.enqueue(task, 2); // Higher priority for retries
          console.log(`🔁 Requeued task ${task.id.value} for retry`);
        } catch (error) {
          console.error(`❌ Failed to requeue retry task ${task.id.value}:`, error);
        }
      });
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Event-Driven Scheduler...');
    this.isShuttingDown = true;

    // Clear timers
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    // Close notification client
    if (this.notificationClient) {
      await this.notificationClient.end();
    }

    console.log('✅ Scheduler shutdown complete');
  }
}

// Main execution
async function main() {
  // Environment validation
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Initialize DI containers
  try {
    initializeDI(contextAwareDb);
    console.log('✅ DI Container initialized for scheduler');
    
    taskSchedulingContainer.initialize(contextAwareDb, rawClient);
    console.log('✅ TaskScheduling Container initialized for scheduler');
  } catch (error) {
    console.error('❌ Failed to initialize DI containers:', error);
    process.exit(1);
  }

  const scheduler = new EventDrivenScheduler();

  // Setup signal handlers
  process.on('SIGINT', async () => {
    await scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await scheduler.shutdown();
    process.exit(0);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  // Start the scheduler
  try {
    await scheduler.start();
    
    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Start the scheduler
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});