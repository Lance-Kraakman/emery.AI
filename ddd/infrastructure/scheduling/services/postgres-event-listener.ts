/**
 * PostgreSQL Event Listener Implementation
 * 
 * Implements database event listening using PostgreSQL LISTEN/NOTIFY
 * Provides real-time event notifications for scheduling operations
 */

import type postgres from 'postgres';
import { createNotificationClient } from '@/lib/db/client';
import type { 
  ISchedulingEventListener, 
  DatabaseEventPayload, 
  DatabaseEventHandler 
} from '@/ddd/domain/scheduling/services/scheduling-event-listener';

export class PostgresEventListener implements ISchedulingEventListener {
  private client: postgres.Sql | null = null;
  private isListening = false;
  private eventHandlers = new Map<string, DatabaseEventHandler[]>();
  private eventsReceived = 0;
  private lastEventTime?: Date;

  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('[POSTGRES-EVENT-LISTENER] Already listening');
      return;
    }

    try {
      console.log('[POSTGRES-EVENT-LISTENER] 🎧 Starting database event listener...');
      
      // Create dedicated notification client
      this.client = createNotificationClient();
      
      // Set up event listeners for different channels
      await this.setupEventChannels();
      
      this.isListening = true;
      console.log('[POSTGRES-EVENT-LISTENER] ✅ Database event listener started successfully');
      
    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Failed to start database listener:', error);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening || !this.client) {
      return;
    }

    try {
      console.log('[POSTGRES-EVENT-LISTENER] 🛑 Stopping database event listener...');
      
      // Unlisten from all channels
      await this.client`UNLISTEN task_event`;
      await this.client`UNLISTEN scheduled_job_event`;
      await this.client`UNLISTEN table_change_event`;
      
      // Close connection
      await this.client.end();
      this.client = null;
      this.isListening = false;
      
      console.log('[POSTGRES-EVENT-LISTENER] ✅ Database event listener stopped');
      
    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Error stopping database listener:', error);
    }
  }

  onTableEvent(
    tableName: string, 
    operations: ('INSERT' | 'UPDATE' | 'DELETE')[], 
    handler: DatabaseEventHandler
  ): void {
    const key = `table_${tableName}_${operations.join('_')}`;
    
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, []);
    }
    
    this.eventHandlers.get(key)!.push(handler);
    console.log(`[POSTGRES-EVENT-LISTENER] 📝 Registered handler for table ${tableName} operations: ${operations.join(', ')}`);
  }

  onTaskEvent(handler: DatabaseEventHandler): void {
    const key = 'task_events';
    
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, []);
    }
    
    this.eventHandlers.get(key)!.push(handler);
    console.log('[POSTGRES-EVENT-LISTENER] 📝 Registered task event handler');
  }

  onScheduledJobEvent(handler: DatabaseEventHandler): void {
    const key = 'scheduled_job_events';
    
    if (!this.eventHandlers.has(key)) {
      this.eventHandlers.set(key, []);
    }
    
    this.eventHandlers.get(key)!.push(handler);
    console.log('[POSTGRES-EVENT-LISTENER] 📝 Registered scheduled job event handler');
  }

  async getListenerStatus(): Promise<{
    isListening: boolean;
    connectedChannels: string[];
    eventsReceived: number;
    lastEventTime?: Date;
    connectionHealth: boolean;
  }> {
    const connectionHealth = await this.healthCheck();
    
    return {
      isListening: this.isListening,
      connectedChannels: this.isListening ? ['task_event', 'scheduled_job_event', 'table_change_event'] : [],
      eventsReceived: this.eventsReceived,
      lastEventTime: this.lastEventTime,
      connectionHealth
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.isListening) {
      return false;
    }

    try {
      // Simple query to test connection
      await this.client`SELECT 1`;
      return true;
    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Health check failed:', error);
      return false;
    }
  }

  private async setupEventChannels(): Promise<void> {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }

    // Set up task event listener
    await this.client.listen('task_event', (payload) => {
      this.handleTaskEvent(payload);
    });

    // Set up scheduled job event listener  
    await this.client.listen('scheduled_job_event', (payload) => {
      this.handleScheduledJobEvent(payload);
    });

    // Set up table change event listener
    await this.client.listen('table_change_event', (payload) => {
      this.handleTableChangeEvent(payload);
    });

    console.log('[POSTGRES-EVENT-LISTENER] 📡 Event channels set up: task_event, scheduled_job_event, table_change_event');
  }

  private async handleTaskEvent(payload: string): Promise<void> {
    try {
      const eventData: DatabaseEventPayload = JSON.parse(payload);
      this.eventsReceived++;
      this.lastEventTime = new Date();

      console.log(`[POSTGRES-EVENT-LISTENER] 📨 Received task event: ${eventData.operation} on ${eventData.table_name}`);

      // Call registered task event handlers
      const handlers = this.eventHandlers.get('task_events') || [];
      await Promise.allSettled(
        handlers.map(handler => handler(eventData))
      );

    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Error handling task event:', error);
    }
  }

  private async handleScheduledJobEvent(payload: string): Promise<void> {
    try {
      const eventData: DatabaseEventPayload = JSON.parse(payload);
      this.eventsReceived++;
      this.lastEventTime = new Date();

      console.log(`[POSTGRES-EVENT-LISTENER] 📨 Received scheduled job event: ${eventData.operation} on ${eventData.table_name}`);

      // Call registered scheduled job event handlers
      const handlers = this.eventHandlers.get('scheduled_job_events') || [];
      await Promise.allSettled(
        handlers.map(handler => handler(eventData))
      );

    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Error handling scheduled job event:', error);
    }
  }

  private async handleTableChangeEvent(payload: string): Promise<void> {
    try {
      const eventData: DatabaseEventPayload = JSON.parse(payload);
      this.eventsReceived++;
      this.lastEventTime = new Date();

      console.log(`[POSTGRES-EVENT-LISTENER] 📨 Received table change event: ${eventData.operation} on ${eventData.table_name}`);

      // Call registered table-specific handlers
      const tableKey = `table_${eventData.table_name}_${eventData.operation}`;
      const wildcardKey = `table_${eventData.table_name}_INSERT_UPDATE_DELETE`;
      
      const handlers = [
        ...(this.eventHandlers.get(tableKey) || []),
        ...(this.eventHandlers.get(wildcardKey) || [])
      ];

      await Promise.allSettled(
        handlers.map(handler => handler(eventData))
      );

    } catch (error) {
      console.error('[POSTGRES-EVENT-LISTENER] ❌ Error handling table change event:', error);
    }
  }
}