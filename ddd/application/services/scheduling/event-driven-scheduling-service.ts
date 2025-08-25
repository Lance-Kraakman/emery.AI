/**
 * Event-Driven Scheduling Application Service
 * 
 * Main orchestrator for event-driven scheduling architecture
 * Combines timer-based periodic checks with real-time database event callbacks
 * Replaces the legacy loop-based scheduler with a more efficient event-driven approach
 */

import type { IEventScheduler, SchedulingEvent } from '@/ddd/domain/scheduling/services/event-scheduler';
import type { SchedulingApplicationService } from './scheduling-application-service';
import { PostgresEventScheduler } from '@/ddd/infrastructure/scheduling/services/postgres-event-scheduler';

export interface EventDrivenSchedulingConfig {
  periodicIntervalMinutes?: number;
  maxConcurrentTasks?: number;
  enableEventLogging?: boolean;
}

export interface EventDrivenSchedulingStatus {
  isRunning: boolean;
  eventScheduler: {
    isRunning: boolean;
    activeListeners: string[];
    eventsProcessed: number;
    lastEventTime?: Date;
    errors: string[];
  };
  scheduling: {
    totalActiveJobs: number;
    pendingEvents: number;
    processingEvents: number;
    failedJobs: number;
    systemLoad: 'low' | 'medium' | 'high';
  };
  lastPeriodicCheck?: Date;
  eventCallbacksRegistered: number;
}

export class EventDrivenSchedulingService {
  private eventScheduler: IEventScheduler;
  private schedulingService: SchedulingApplicationService;
  private isRunning = false;
  private config: Required<EventDrivenSchedulingConfig>;
  private lastPeriodicCheck?: Date;
  private eventCallbacksRegistered = 0;

  constructor(
    schedulingService: SchedulingApplicationService,
    eventScheduler?: IEventScheduler,
    config: EventDrivenSchedulingConfig = {}
  ) {
    this.schedulingService = schedulingService;
    this.eventScheduler = eventScheduler || new PostgresEventScheduler();
    
    // Set default configuration
    this.config = {
      periodicIntervalMinutes: config.periodicIntervalMinutes || 5,
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      enableEventLogging: config.enableEventLogging ?? true
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[EVENT-DRIVEN-SCHEDULER] Already running');
      return;
    }

    try {
      console.log('[EVENT-DRIVEN-SCHEDULER] 🚀 Starting event-driven scheduling service...');
      console.log(`[EVENT-DRIVEN-SCHEDULER] 📋 Config: ${JSON.stringify(this.config)}`);

      // Register event callbacks
      this.registerEventCallbacks();

      // Start the event scheduler (sets up database listeners and timers)
      await this.eventScheduler.start();

      this.isRunning = true;
      console.log('[EVENT-DRIVEN-SCHEDULER] ✅ Event-driven scheduling service started successfully');

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Failed to start service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('[EVENT-DRIVEN-SCHEDULER] 🛑 Stopping event-driven scheduling service...');

      // Stop the event scheduler
      await this.eventScheduler.stop();

      this.isRunning = false;
      console.log('[EVENT-DRIVEN-SCHEDULER] ✅ Event-driven scheduling service stopped');

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Error stopping service:', error);
    }
  }

  async getStatus(): Promise<EventDrivenSchedulingStatus> {
    const eventSchedulerStatus = await this.eventScheduler.getStatus();
    const schedulingSystemStatus = await this.schedulingService.getSystemStatus();

    return {
      isRunning: this.isRunning,
      eventScheduler: eventSchedulerStatus,
      scheduling: schedulingSystemStatus.health,
      lastPeriodicCheck: this.lastPeriodicCheck,
      eventCallbacksRegistered: this.eventCallbacksRegistered
    };
  }

  /**
   * Manually trigger a scheduling cycle (useful for testing)
   */
  async triggerManualCycle(): Promise<void> {
    const event: SchedulingEvent = {
      type: 'periodic_check',
      payload: {
        timestamp: new Date(),
        metadata: {
          source: 'manual_trigger'
        }
      },
      priority: 'high'
    };

    await this.eventScheduler.triggerEvent(event);
  }

  private registerEventCallbacks(): void {
    console.log('[EVENT-DRIVEN-SCHEDULER] 📝 Registering event callbacks...');

    // Task creation events - immediate execution
    this.eventScheduler.onEvent('task_created', async (event) => {
      await this.handleTaskCreatedEvent(event);
    });
    this.eventCallbacksRegistered++;

    // Scheduled job due events - immediate execution
    this.eventScheduler.onEvent('scheduled_job_due', async (event) => {
      await this.handleScheduledJobDueEvent(event);
    });
    this.eventCallbacksRegistered++;

    // Table change events - conditional execution based on agent triggers
    this.eventScheduler.onEvent('table_changed', async (event) => {
      await this.handleTableChangedEvent(event);
    });
    this.eventCallbacksRegistered++;

    // Periodic check events - comprehensive scheduling cycle
    this.eventScheduler.onEvent('periodic_check', async (event) => {
      await this.handlePeriodicCheckEvent(event);
    });
    this.eventCallbacksRegistered++;

    console.log(`[EVENT-DRIVEN-SCHEDULER] ✅ Registered ${this.eventCallbacksRegistered} event callbacks`);
  }

  private async handleTaskCreatedEvent(event: SchedulingEvent): Promise<void> {
    try {
      if (this.config.enableEventLogging) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] 📨 Processing task_created event for task ${event.payload.taskId}`);
      }

      // Task creation is handled automatically by the system
      // This callback is mainly for monitoring and logging
      // Could be extended to handle priority queuing or load balancing

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Error handling task_created event:', error);
    }
  }

  private async handleScheduledJobDueEvent(event: SchedulingEvent): Promise<void> {
    try {
      if (this.config.enableEventLogging) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] 📨 Processing scheduled_job_due event for job ${event.payload.jobId}`);
      }

      // Process scheduled jobs that are due for execution
      const result = await this.schedulingService.processSchedulingCycle();
      
      if (this.config.enableEventLogging) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] ✅ Scheduled job cycle completed: ${result.dueJobs} jobs processed`);
      }

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Error handling scheduled_job_due event:', error);
    }
  }

  private async handleTableChangedEvent(event: SchedulingEvent): Promise<void> {
    try {
      if (this.config.enableEventLogging) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] 📨 Processing table_changed event for table ${event.payload.tableName}`);
      }

      // Process database-triggered agent executions
      // This would trigger agents that are configured to respond to specific table changes
      const result = await this.schedulingService.processSchedulingCycle();
      
      if (this.config.enableEventLogging && result.dueJobs > 0) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] ✅ Table change cycle completed: ${result.dueJobs} jobs processed`);
      }

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Error handling table_changed event:', error);
    }
  }

  private async handlePeriodicCheckEvent(event: SchedulingEvent): Promise<void> {
    try {
      this.lastPeriodicCheck = new Date();
      
      if (this.config.enableEventLogging) {
        console.log('[EVENT-DRIVEN-SCHEDULER] ⏰ Processing periodic_check event');
      }

      // Comprehensive scheduling cycle - fallback mechanism to ensure no jobs are missed
      const result = await this.schedulingService.processSchedulingCycle();
      
      if (this.config.enableEventLogging) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] ✅ Periodic check completed: ${result.dueJobs} jobs, ${result.eventsProcessed} events processed`);
      }

      // Perform system maintenance if needed
      if (result.failed > 0) {
        console.log(`[EVENT-DRIVEN-SCHEDULER] ⚠️ ${result.failed} failed executions in periodic check`);
        // Could trigger maintenance operations here
      }

    } catch (error) {
      console.error('[EVENT-DRIVEN-SCHEDULER] ❌ Error handling periodic_check event:', error);
    }
  }
}