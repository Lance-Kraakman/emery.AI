#!/usr/bin/env tsx

import {
  getTaskRepository,
  getTaskQueueService,
  getSchedulerService,
  taskSchedulingContainer
} from "@/ddd/application/di/scheduling-container";
import {
  getAgentTaskApplicationService,
  getStorageRecalculationApplicationService,
  initializeDI
} from "@/ddd/application/di/container";
import { createNotificationClient, rawClient } from "@/lib/db/client";
import { contextAwareDb } from "@/lib/db/simple-context-proxy";
import { withSystemContext } from "@/lib/db/system-context";
import { TaskId } from "@/ddd/domain/tasks/value-objects/task-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import type { TaskEvent } from "@/ddd/domain/scheduling";
import { CalendarTriggerConfig, DatabaseEventTriggerConfig, TriggerConfigFromJSON } from "@/ddd/domain/scheduling/value-objects/trigger-config";
import { getAgentRepository, getSkillRepository } from "@/ddd/application/di/container";
import { InstructionTemplateService } from "@/ddd/domain/tasks/services/instruction-template-service";
import type { TriggerContext } from "@/ddd/domain/tasks/entities/task";
import postgres from "postgres";
import * as cron from "node-cron";

/**
 * Timestamped logging helper for scheduler
 */
const log = (emoji: string, message: string) => {
  console.log(`[${new Date().toISOString()}] ${emoji} ${message}`);
};

const logError = (emoji: string, message: string, error?: unknown) => {
  console.error(`[${new Date().toISOString()}] ${emoji} ${message}`, error ?? '');
};

const logWarn = (emoji: string, message: string) => {
  console.warn(`[${new Date().toISOString()}] ${emoji} ${message}`);
};

/**
 * Event-Driven Scheduler
 * Listens to PostgreSQL events and orchestrates task execution
 */
class EventDrivenScheduler {
  private notificationClient: postgres.Sql | null = null;
  private isShuttingDown = false;
  private fallbackTimer: NodeJS.Timeout | null = null;
  private storageRecalculationCron: cron.ScheduledTask | null = null;

  constructor(
    private agentTaskService = getAgentTaskApplicationService(),
    private schedulerService = getSchedulerService(),
    private taskRepository = getTaskRepository(),
    private taskQueueService = getTaskQueueService(),
    private storageRecalculationService = getStorageRecalculationApplicationService()
  ) {}

  async start(): Promise<void> {
    log('🚀', 'Starting Event-Driven Scheduler...');
    log('📊', `Environment: ${process.env.NODE_ENV || 'development'}`);
    log('🗄️', `Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

    try {
      // 1. Setup PostgreSQL event listeners
      await this.setupEventListeners();
      log('✅', 'PostgreSQL event listeners configured');

      // 2. Start fallback timer for scheduled tasks (5 minutes)
      this.startFallbackTimer();
      log('⏰', 'Fallback timer started (5 minute intervals)');

      // 3. Start hourly storage recalculation
      this.startStorageRecalculationCron();
      log('💾', 'Storage recalculation cron started (hourly)');

      // 4. Process any existing queued tasks on startup
      await this.processQueuedTasks();
      log('📋', 'Initial queue processed');

      log('✅', 'Event-Driven Scheduler started successfully');
      log('🎧', 'Listening for task_event and rag_reindex_needed events...');

    } catch (error) {
      logError('❌', 'Failed to start scheduler:', error);
      throw error;
    }
  }

  private async setupEventListeners(): Promise<void> {
    this.notificationClient = createNotificationClient();

    // Listen for task events (primarily MANUAL triggers via database)
    await this.notificationClient.listen('task_event', async (payload) => {
      try {
        const event = JSON.parse(payload);
        log('📨', `Received task_event: taskId=${event.taskId}`);
        await this.handleTaskEvent(event);
      } catch (error) {
        logError('❌', 'Error handling task_event:', error);
      }
    });

    log('🎧', 'Listening for task_event...');
  }

  private async handleTaskEvent(event: TaskEvent): Promise<void> {
    return withSystemContext(event.organizationId, async () => {
      if (!event.taskId) {
        logWarn('⚠️', 'task_event missing taskId');
        return;
      }
      // This is a manual task execution
      const task = await this.taskRepository.findById(TaskId.fromString(event.taskId));
      if (task && task.isPending) {
        await this.agentTaskService.executeTask({ taskId: event.taskId });
        log('✅', `Processed task ${event.taskId}`);
      } else {
        log('⏭️', `Skipping task ${event.taskId} (not found or not pending)`);
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
        logError('❌', 'Error in fallback timer:', error);
      }
    }, 300000); // 5 minutes
  }

  private async processScheduledTasks(): Promise<void> {
    // Handle CALENDAR triggers
    // AIDEV-NOTE: getAutomationsDueForExecution returns automation references, not tasks.
    // We need to look up skills by skillId to get execution instructions.
    const dueAutomations = await this.schedulerService.getAutomationsDueForExecution();

    if (dueAutomations.length > 0) {
      log('⏰', `Processing ${dueAutomations.length} scheduled automations`);

      for (const automation of dueAutomations) {
        const agentRepository = getAgentRepository();
        const agent = await agentRepository.findById(automation.agentId);
        if (!agent) {
          log('⚠️', `Agent ${automation.agentId.value} not found, skipping automation`);
          continue;
        }

        await withSystemContext(agent.organizationId, async () => {
          try {
            // 1. Generate trigger context for CALENDAR triggers
            const now = new Date();
            let triggerContext: TriggerContext | undefined;

            if (automation.trigger instanceof CalendarTriggerConfig) {
              triggerContext = {
                type: 'CALENDAR',
                scheduleName: automation.automationName,
                calendarData: {
                  scheduledTime: now.toISOString(),
                  timezone: automation.trigger.timezone || 'UTC'
                }
              };
            }

            // 2. Apply inputMappings to resolve skill inputs from trigger data
            const skillInputs: Record<string, any> = {};
            if (automation.inputMappings && automation.inputMappings.length > 0 && triggerContext) {
              // Build variable map from trigger context (with $ prefix for mapping syntax)
              const triggerVariables = InstructionTemplateService.buildVariableMapForMappings(triggerContext);

              for (const mapping of automation.inputMappings) {
                // Resolve the trigger field value
                const value = triggerVariables[mapping.triggerField];
                if (value !== undefined) {
                  skillInputs[mapping.skillInputName] = value;
                  log('📥', `Mapped ${mapping.triggerField} → ${mapping.skillInputName}: ${JSON.stringify(value).substring(0, 50)}`);
                }
              }
            }

            // 3. Create task with skill reference and resolved inputs
            const createData = {
              agentId: automation.agentId.value,
              organizationId: agent.organizationId.value,
              name: automation.automationName,
              instructions: {
                task: `Execute skill ID ${automation.skillId}`,
                metadata: {
                  skillId: automation.skillId,
                  skillInputs: Object.keys(skillInputs).length > 0 ? skillInputs : undefined
                }
              },
              skillId: automation.skillId,
              triggerContext,
              status: 'pending',
              createdAt: new Date()
            };
            const task = await this.taskRepository.create(createData);
            await this.agentTaskService.executeTask({ taskId: task.id.value });
            log('✅', `Executed automation ${automation.automationName} for agent ${automation.agentId.value}${Object.keys(skillInputs).length > 0 ? ` with ${Object.keys(skillInputs).length} inputs` : ''}`);
          } catch (error) {
            logError('❌', `Failed to process scheduled automation ${automation.automationName}:`, error);
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
          logError('❌', `Failed to process queued task ${task.id.value}:`, error);
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
          log('⏱️', `Marked task ${task.id.value} as timed out`);
        } catch (error) {
          logError('❌', `Failed to handle timeout for task ${task.id.value}:`, error);
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
          log('🔁', `Requeued task ${task.id.value} for retry`);
        } catch (error) {
          logError('❌', `Failed to requeue retry task ${task.id.value}:`, error);
        }
      });
    }
  }

  /**
   * Start hourly storage recalculation cron job
   * Runs every hour at minute 0 to validate storage counters against actual S3 usage
   */
  private startStorageRecalculationCron(): void {
    // Run every hour at minute 0: '0 * * * *'
    this.storageRecalculationCron = cron.schedule('0 * * * *', async () => {
      if (this.isShuttingDown) return;

      try {
        log('💾', 'Starting hourly storage recalculation...');

        const result = await this.storageRecalculationService.recalculateAllOrganizations();

        if (result.success && result.data) {
          const { successCount, errorCount, discrepanciesFound, totalBytesRecalculated } = result.data;

          log('✅', `Storage recalculation complete: ${successCount} organizations processed, ${errorCount} errors, ${discrepanciesFound} discrepancies found, ${(totalBytesRecalculated / (1024 * 1024 * 1024)).toFixed(2)} GB total`);

          // Log errors if any
          if (result.data.errors.length > 0) {
            logError('⚠️', `Storage recalculation had ${result.data.errors.length} errors:`, result.data.errors);
          }

          // Log top discrepancies
          if (discrepanciesFound > 0) {
            logWarn('⚠️', `Found ${discrepanciesFound} organizations with storage drift`);
          }
        } else {
          logError('❌', 'Storage recalculation failed:', result.error);
        }
      } catch (error) {
        logError('❌', 'Error in storage recalculation cron:', error);
      }
    });
  }

  async shutdown(): Promise<void> {
    log('🛑', 'Shutting down Event-Driven Scheduler...');
    this.isShuttingDown = true;

    // Clear timers
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    // Stop cron jobs
    if (this.storageRecalculationCron) {
      this.storageRecalculationCron.stop();
    }

    // Close notification client
    if (this.notificationClient) {
      await this.notificationClient.end();
    }

    log('✅', 'Scheduler shutdown complete');
  }
}

// Main execution
async function main() {
  // Environment validation
  if (!process.env.DATABASE_URL) {
    logError('❌', 'DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Initialize DI containers
  try {
    initializeDI(contextAwareDb);
    log('✅', 'DI Container initialized for scheduler');

    taskSchedulingContainer.initialize(contextAwareDb, rawClient);
    log('✅', 'TaskScheduling Container initialized for scheduler');
  } catch (error) {
    logError('❌', 'Failed to initialize DI containers:', error);
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
    logError('❌', 'Unhandled Rejection at:', { promise, reason });
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logError('❌', 'Uncaught Exception:', error);
    process.exit(1);
  });

  // Start the scheduler
  try {
    await scheduler.start();

    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    logError('❌', 'Fatal error:', error);
    process.exit(1);
  }
}

// Start the scheduler
main().catch((error) => {
  logError('❌', 'Fatal error:', error);
  process.exit(1);
});