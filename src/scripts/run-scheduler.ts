#!/usr/bin/env tsx

/**
 * SECURITY BOUNDARY: System Scheduler
 *
 * This process runs with system-level privileges (cross-org access via withSystemContext).
 * It loads agents and automations from ALL organizations to evaluate trigger schedules.
 *
 * Security considerations:
 * - Must be deployed in a trusted environment, not exposed to user input
 * - The cross-org findAll() pattern is intentional — scheduler needs visibility across all orgs
 * - Each automation execution is scoped to its own org via withSystemContext()
 * - RLS context isolation (AsyncLocalStorage) prevents cross-contamination between orgs
 * - If this process is compromised, all org data is at risk — treat as high-privilege
 */

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
import { createNotificationClient, rawClient } from "@/ddd/infrastructure/db/client";
import { contextAwareDb } from "@/ddd/infrastructure/db/simple-context-proxy";
import { withSystemContext } from "@/ddd/infrastructure/db/system-context";
import { TaskId } from "@/ddd/domain/tasks/value-objects/task-id";
import type { TaskEvent } from "@/ddd/domain/scheduling";
import { CalendarTriggerConfig } from "@/ddd/domain/scheduling/value-objects/trigger-config";
import { getAgentRepository } from "@/ddd/application/di/container";
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

/** Format byte count as human-readable string */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)}${units[i]}`;
};

/** Format byte difference with +/- prefix */
const formatDiff = (bytes: number): string => {
  if (bytes === 0) return '0B';
  const prefix = bytes > 0 ? '+' : '';
  return `${prefix}${formatBytes(Math.abs(bytes))}`;
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

      // 3. Start storage recalculation (run once immediately, then on cron)
      this.startStorageRecalculationCron();
      const recalcInterval = parseInt(process.env.STORAGE_RECALC_INTERVAL_MINUTES || '5', 10);
      log('💾', `Storage recalculation cron started (every ${recalcInterval} min)`);
      this.runStorageRecalculation();

      // 4. Clean up orphaned tasks from previous runs
      await this.cleanupOrphanedTasks();
      log('🧹', 'Orphaned task cleanup complete');

      // 5. Process any existing queued tasks on startup
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

        // Clean up orphaned tasks
        await this.cleanupOrphanedTasks();
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

  private async cleanupOrphanedTasks(): Promise<void> {
    const cutoff = new Date(Date.now() - 300000); // 5 minutes ago

    // Find zombie IN_PROGRESS tasks (stuck from a crash)
    // AIDEV-NOTE: Uses raw method to query across all orgs (bypasses RLS)
    const stuckTasks = await this.taskRepository.findStuckInProgressRaw(cutoff);

    // Find stale PENDING tasks (missed their event notification)
    // AIDEV-NOTE: Uses raw method to query across all orgs (bypasses RLS)
    const stalePending = await this.taskRepository.findPendingTasksRaw();
    const orphanedPending = stalePending.filter(t => t.createdAt < cutoff);

    const total = stuckTasks.length + orphanedPending.length;
    if (total === 0) return;

    log('🧹', `Found ${stuckTasks.length} stuck in-progress and ${orphanedPending.length} orphaned pending tasks`);

    for (const task of [...stuckTasks, ...orphanedPending]) {
      await withSystemContext(task.organizationId, async () => {
        try {
          if (task.isPending) {
            task.cancel('Orphaned task cleaned up by scheduler');
          } else {
            task.fail('Orphaned task cleaned up by scheduler');
          }
          await this.taskRepository.update(task.id, {
            status: task.status.value,
            error: task.error,
            completedAt: task.completedAt,
          });
        } catch (error) {
          logError('❌', `Failed to clean up orphaned task ${task.id.value}:`, error);
        }
      });
    }

    log('🧹', `Cleaned up ${total} orphaned tasks`);
  }

  /**
   * Start storage recalculation cron job
   * Validates storage counters against actual S3 usage at a configurable interval.
   * Default: every 5 minutes. Override via STORAGE_RECALC_INTERVAL_MINUTES env var.
   */
  private startStorageRecalculationCron(): void {
    const intervalMinutes = parseInt(process.env.STORAGE_RECALC_INTERVAL_MINUTES || '5', 10);
    const cronExpression = `*/${intervalMinutes} * * * *`;

    this.storageRecalculationCron = cron.schedule(cronExpression, () => {
      if (!this.isShuttingDown) this.runStorageRecalculation();
    });
  }

  private async runStorageRecalculation(): Promise<void> {
    try {
      log('💾', 'Starting storage recalculation...');

      const result = await this.storageRecalculationService.recalculateAllOrganizations();

      if (result.success && result.data) {
        const { successCount, errorCount, discrepanciesFound, totalBytesRecalculated, results } = result.data;

        log('✅', `Storage recalculation complete: ${successCount} organizations processed, ${errorCount} errors, ${discrepanciesFound} discrepancies found, ${formatBytes(totalBytesRecalculated)} total`);

        if (result.data.errors.length > 0) {
          logError('⚠️', `Storage recalculation had ${result.data.errors.length} errors:`, result.data.errors);
        }

        if (discrepanciesFound > 0) {
          const drifted = results
            .filter(r => r.hadDiscrepancy && r.discrepancy)
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

          for (const r of drifted) {
            const d = r.discrepancy!;
            logWarn('⚠️', `Storage drift for "${r.organizationName}" (id=${r.organizationId}):\n` +
              `  database:  tracked=${formatBytes(d.tracked.databaseBytes)}  actual=${formatBytes(d.actual.databaseBytes)}  (${formatDiff(d.difference.databaseBytes)})\n` +
              `  chat:      tracked=${formatBytes(d.tracked.chatBytes)}  actual=${formatBytes(d.actual.chatBytes)}  (${formatDiff(d.difference.chatBytes)})\n` +
              `  skill:     tracked=${formatBytes(d.tracked.skillBytes)}  actual=${formatBytes(d.actual.skillBytes)}  (${formatDiff(d.difference.skillBytes)})\n` +
              `  workspace: tracked=${formatBytes(d.tracked.workspaceBytes)}  actual=${formatBytes(d.actual.workspaceBytes)}  (${formatDiff(d.difference.workspaceBytes)})\n` +
              `  total:     tracked=${formatBytes(d.tracked.totalBytes)}  actual=${formatBytes(d.actual.totalBytes)}  (${formatDiff(d.difference.totalBytes)}, ${d.percentageDrift.toFixed(1)}% drift)`
            );
          }
        }
      } else {
        logError('❌', 'Storage recalculation failed:', result.error);
      }
    } catch (error) {
      logError('❌', 'Error in storage recalculation:', error);
    }
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