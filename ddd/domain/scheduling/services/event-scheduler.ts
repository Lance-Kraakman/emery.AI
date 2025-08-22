/**
 * Event Scheduler Domain Service Interface
 * 
 * Defines contracts for event-driven scheduling infrastructure
 * Combines timer-based scheduling with database event callbacks
 */

export interface SchedulingEvent {
  type: 'task_created' | 'scheduled_job_due' | 'table_changed' | 'periodic_check';
  payload: {
    agentId?: number;
    taskId?: string;
    jobId?: string;
    tableName?: string;
    operation?: 'INSERT' | 'UPDATE' | 'DELETE';
    timestamp: Date;
    metadata?: Record<string, any>;
  };
  priority: 'high' | 'medium' | 'low';
}

export interface SchedulingEventCallback {
  (event: SchedulingEvent): Promise<void>;
}

export interface IEventScheduler {
  /**
   * Start the event scheduler - sets up database listeners and timers
   */
  start(): Promise<void>;

  /**
   * Stop the event scheduler - cleans up listeners and timers
   */
  stop(): Promise<void>;

  /**
   * Register callback for specific event types
   */
  onEvent(eventType: SchedulingEvent['type'], callback: SchedulingEventCallback): void;

  /**
   * Manually trigger a scheduling event (useful for testing)
   */
  triggerEvent(event: SchedulingEvent): Promise<void>;

  /**
   * Get current scheduler status and metrics
   */
  getStatus(): Promise<{
    isRunning: boolean;
    activeListeners: string[];
    eventsProcessed: number;
    lastEventTime?: Date;
    errors: string[];
  }>;
}