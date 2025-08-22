/**
 * PostgreSQL Event Scheduler Implementation
 * 
 * Implements event-driven scheduling using PostgreSQL infrastructure
 * Combines timer-based scheduling with real-time database event callbacks
 */

import type { 
  IEventScheduler, 
  SchedulingEvent, 
  SchedulingEventCallback 
} from '@/ddd/domain/scheduling/services/event-scheduler';
import type { 
  ISchedulingEventListener, 
  DatabaseEventPayload 
} from '@/ddd/domain/scheduling/services/scheduling-event-listener';
import { PostgresEventListener } from './postgres-event-listener';

export class PostgresEventScheduler implements IEventScheduler {
  private eventListener: ISchedulingEventListener;
  private isRunning = false;
  private periodicTimer: NodeJS.Timeout | null = null;
  private eventCallbacks = new Map<SchedulingEvent['type'], SchedulingEventCallback[]>();
  private eventsProcessed = 0;
  private lastEventTime?: Date;
  private errors: string[] = [];

  // Configuration
  private readonly periodicIntervalMinutes: number;

  constructor(
    eventListener?: ISchedulingEventListener,
    periodicIntervalMinutes: number = 5
  ) {
    this.eventListener = eventListener || new PostgresEventListener();
    this.periodicIntervalMinutes = periodicIntervalMinutes;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[POSTGRES-EVENT-SCHEDULER] Already running');
      return;
    }

    try {
      console.log('[POSTGRES-EVENT-SCHEDULER] 🚀 Starting event-driven scheduler...');

      // Start database event listener
      await this.eventListener.startListening();

      // Set up database event handlers
      this.setupDatabaseEventHandlers();

      // Start periodic timer
      this.startPeriodicTimer();

      this.isRunning = true;
      console.log('[POSTGRES-EVENT-SCHEDULER] ✅ Event-driven scheduler started successfully');
      console.log(`[POSTGRES-EVENT-SCHEDULER] 📋 Periodic check interval: ${this.periodicIntervalMinutes} minutes`);

    } catch (error) {
      console.error('[POSTGRES-EVENT-SCHEDULER] ❌ Failed to start scheduler:', error);
      this.errors.push(`Startup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('[POSTGRES-EVENT-SCHEDULER] 🛑 Stopping event-driven scheduler...');

      // Stop periodic timer
      if (this.periodicTimer) {
        clearInterval(this.periodicTimer);
        this.periodicTimer = null;
      }

      // Stop database event listener
      await this.eventListener.stopListening();

      this.isRunning = false;
      console.log('[POSTGRES-EVENT-SCHEDULER] ✅ Event-driven scheduler stopped');

    } catch (error) {
      console.error('[POSTGRES-EVENT-SCHEDULER] ❌ Error stopping scheduler:', error);
      this.errors.push(`Shutdown error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  onEvent(eventType: SchedulingEvent['type'], callback: SchedulingEventCallback): void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, []);
    }

    this.eventCallbacks.get(eventType)!.push(callback);
    console.log(`[POSTGRES-EVENT-SCHEDULER] 📝 Registered callback for event type: ${eventType}`);
  }

  async triggerEvent(event: SchedulingEvent): Promise<void> {
    try {
      console.log(`[POSTGRES-EVENT-SCHEDULER] 🎯 Triggering event: ${event.type} (priority: ${event.priority})`);

      const callbacks = this.eventCallbacks.get(event.type) || [];
      
      if (callbacks.length === 0) {
        console.log(`[POSTGRES-EVENT-SCHEDULER] ⚠️ No callbacks registered for event type: ${event.type}`);
        return;
      }

      // Execute callbacks in parallel
      const results = await Promise.allSettled(
        callbacks.map(callback => callback(event))
      );

      // Track results
      let successful = 0;
      let failed = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successful++;
        } else {
          failed++;
          console.error(`[POSTGRES-EVENT-SCHEDULER] ❌ Callback ${index} failed:`, result.reason);
          this.errors.push(`Event ${event.type} callback failed: ${result.reason}`);
        }
      });

      this.eventsProcessed++;
      this.lastEventTime = new Date();

      console.log(`[POSTGRES-EVENT-SCHEDULER] ✅ Event ${event.type} processed: ${successful} successful, ${failed} failed`);

    } catch (error) {
      console.error('[POSTGRES-EVENT-SCHEDULER] ❌ Error triggering event:', error);
      this.errors.push(`Event trigger error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    activeListeners: string[];
    eventsProcessed: number;
    lastEventTime?: Date;
    errors: string[];
  }> {
    const listenerStatus = await this.eventListener.getListenerStatus();

    return {
      isRunning: this.isRunning,
      activeListeners: listenerStatus.connectedChannels,
      eventsProcessed: this.eventsProcessed,
      lastEventTime: this.lastEventTime,
      errors: this.errors.slice(-10) // Keep last 10 errors
    };
  }

  private setupDatabaseEventHandlers(): void {
    // Handle task events
    this.eventListener.onTaskEvent(async (payload: DatabaseEventPayload) => {
      const event: SchedulingEvent = {
        type: 'task_created',
        payload: {
          taskId: payload.new_data?.id,
          agentId: payload.new_data?.agent_id,
          timestamp: new Date(),
          metadata: {
            operation: payload.operation,
            tableName: payload.table_name
          }
        },
        priority: 'high' // Task creation is high priority
      };

      await this.triggerEvent(event);
    });

    // Handle scheduled job events
    this.eventListener.onScheduledJobEvent(async (payload: DatabaseEventPayload) => {
      const event: SchedulingEvent = {
        type: 'scheduled_job_due',
        payload: {
          jobId: payload.new_data?.id,
          agentId: payload.new_data?.agent_id,
          timestamp: new Date(),
          metadata: {
            operation: payload.operation,
            tableName: payload.table_name,
            nextExecution: payload.new_data?.next_execution
          }
        },
        priority: 'medium' // Scheduled jobs are medium priority
      };

      await this.triggerEvent(event);
    });

    // Handle table change events (for database-triggered agents)
    this.eventListener.onTableEvent('*', ['INSERT', 'UPDATE', 'DELETE'], async (payload: DatabaseEventPayload) => {
      const event: SchedulingEvent = {
        type: 'table_changed',
        payload: {
          tableName: payload.table_name,
          operation: payload.operation,
          timestamp: new Date(),
          metadata: {
            oldData: payload.old_data,
            newData: payload.new_data,
            changedFields: payload.changed_fields
          }
        },
        priority: 'low' // Table changes are low priority
      };

      await this.triggerEvent(event);
    });

    console.log('[POSTGRES-EVENT-SCHEDULER] 📡 Database event handlers configured');
  }

  private startPeriodicTimer(): void {
    const intervalMs = this.periodicIntervalMinutes * 60 * 1000;

    this.periodicTimer = setInterval(async () => {
      try {
        console.log(`[POSTGRES-EVENT-SCHEDULER] ⏰ Periodic check (every ${this.periodicIntervalMinutes} minutes)`);

        const event: SchedulingEvent = {
          type: 'periodic_check',
          payload: {
            timestamp: new Date(),
            metadata: {
              intervalMinutes: this.periodicIntervalMinutes
            }
          },
          priority: 'low'
        };

        await this.triggerEvent(event);

      } catch (error) {
        console.error('[POSTGRES-EVENT-SCHEDULER] ❌ Error in periodic check:', error);
        this.errors.push(`Periodic check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }, intervalMs);

    console.log(`[POSTGRES-EVENT-SCHEDULER] ⏰ Periodic timer started (${this.periodicIntervalMinutes} minute intervals)`);
  }
}