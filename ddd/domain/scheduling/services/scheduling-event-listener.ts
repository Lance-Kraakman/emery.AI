/**
 * Scheduling Event Listener Domain Interface
 * 
 * Defines contracts for database event listening infrastructure
 * Handles PostgreSQL LISTEN/NOTIFY events for real-time scheduling
 */

export interface DatabaseEventPayload {
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
  row_id?: string | number;
}

export interface DatabaseEventHandler {
  (payload: DatabaseEventPayload): Promise<void>;
}

export interface ISchedulingEventListener {
  /**
   * Start listening to database events
   */
  startListening(): Promise<void>;

  /**
   * Stop listening to database events
   */
  stopListening(): Promise<void>;

  /**
   * Register handler for specific table events
   */
  onTableEvent(
    tableName: string, 
    operations: ('INSERT' | 'UPDATE' | 'DELETE')[], 
    handler: DatabaseEventHandler
  ): void;

  /**
   * Register handler for task-related events
   */
  onTaskEvent(handler: DatabaseEventHandler): void;

  /**
   * Register handler for scheduled job events
   */
  onScheduledJobEvent(handler: DatabaseEventHandler): void;

  /**
   * Get listener status and statistics
   */
  getListenerStatus(): Promise<{
    isListening: boolean;
    connectedChannels: string[];
    eventsReceived: number;
    lastEventTime?: Date;
    connectionHealth: boolean;
  }>;

  /**
   * Health check for database connection
   */
  healthCheck(): Promise<boolean>;
}