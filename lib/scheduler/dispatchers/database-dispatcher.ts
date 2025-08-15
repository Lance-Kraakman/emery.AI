/**
 * Database Dispatcher - Handles task execution triggered by database changes
 * Uses PostgreSQL triggers and LISTEN/NOTIFY for real-time execution
 */

import { createNotificationClient, db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { taskExecutionPipeline, type TaskCreationRequest } from '../task-execution-pipeline';
import type { TriggerConfig } from '@/app/actions/types';
import type postgres from 'postgres';

export interface DatabaseEventPayload {
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
}

export interface DatabaseEventConfig {
  table_id?: string;
  operations: ('INSERT' | 'UPDATE' | 'DELETE')[];
  conditions?: Record<string, any>;
}

export class DatabaseDispatcher {
  private isListening = false;
  private notificationListener: postgres.Sql | null = null;
  private activeAgents = new Map<number, { agent: any; config: DatabaseEventConfig }>();

  /**
   * Start listening for database event notifications
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log('[DATABASE-DISPATCHER] Already listening');
      return;
    }

    try {
      console.log('[DATABASE-DISPATCHER] 🎧 Starting database event listener...');
      
      // Load agents with DATABASE_EVENT triggers
      await this.loadDatabaseEventAgents();
      
      // Create dedicated notification client using centralized configuration
      this.notificationListener = createNotificationClient();
      
      // Handle database change notifications using postgres.js listen pattern
      await this.notificationListener.listen('table_change_event', async (payload: string) => {
        console.log(`[DATABASE-DISPATCHER] 🔔 Database event notification received`);
        
        try {
          const eventPayload: DatabaseEventPayload = JSON.parse(payload);
          await this.processDatabaseEvent(eventPayload);
        } catch (error) {
          console.error('[DATABASE-DISPATCHER] ❌ Error processing database event:', error);
        }
      });
      
      this.isListening = true;
      console.log(`[DATABASE-DISPATCHER] ✅ Database event listener started (${this.activeAgents.size} agents)`);
      
    } catch (error) {
      console.error('[DATABASE-DISPATCHER] ❌ Failed to start database event listener:', error);
    }
  }

  /**
   * Stop listening for database event notifications
   */
  async stop(): Promise<void> {
    if (!this.isListening) return;

    try {
      if (this.notificationListener) {
        await this.notificationListener`UNLISTEN table_change_event`;
        await this.notificationListener.end();
        this.notificationListener = null;
      }
      
      this.activeAgents.clear();
      this.isListening = false;
      console.log('[DATABASE-DISPATCHER] 🛑 Database event listener stopped');
    } catch (error) {
      console.error('[DATABASE-DISPATCHER] ❌ Error stopping database event listener:', error);
    }
  }

  /**
   * Load agents that have DATABASE_EVENT triggers
   */
  private async loadDatabaseEventAgents(): Promise<void> {
    try {
      const agentsWithDbTriggers = await db
        .select()
        .from(agents)
        .where(eq(agents.status, 'active'));

      this.activeAgents.clear();

      for (const agent of agentsWithDbTriggers) {
        const triggerConfig = agent.trigger as TriggerConfig;
        
        if (triggerConfig?.type === 'DATABASE_EVENT') {
          const config: DatabaseEventConfig = {
            table_id: triggerConfig.table_id?.toString(),
            operations: ['INSERT', 'UPDATE', 'DELETE'], // Default all operations for now
            conditions: undefined // TODO: Add conditions support
          };
          
          this.activeAgents.set(agent.id, { agent, config });
          console.log(`[DATABASE-DISPATCHER] 📋 Loaded agent ${agent.id} (${agent.name}) for table ${config.table_id}`);
        }
      }
    } catch (error) {
      console.error('[DATABASE-DISPATCHER] ❌ Error loading database event agents:', error);
    }
  }

  /**
   * Process a database event and trigger relevant agents
   */
  private async processDatabaseEvent(event: DatabaseEventPayload): Promise<void> {
    console.log(`[DATABASE-DISPATCHER] 🗃️ Processing ${event.operation} on ${event.table_name}`);
    console.log(`[DATABASE-DISPATCHER] 🔍 Event payload:`, JSON.stringify(event, null, 2));

    // Special handling for tasks table - automatically execute new tasks
    if (event.table_name === 'tasks' && event.operation === 'INSERT' && event.new_data) {
      console.log(`[DATABASE-DISPATCHER] 🎯 Calling processNewTask for task`);
      await this.processNewTask(event.new_data);
    } else {
      console.log(`[DATABASE-DISPATCHER] ⚠️ Task condition not met:`, {
        table_name: event.table_name,
        operation: event.operation,
        has_new_data: !!event.new_data
      });
    }

    // Process regular database event agents
    for (const [agentId, { agent, config }] of Array.from(this.activeAgents)) {
      try {
        // Check if this agent should be triggered by this event
        if (this.shouldTriggerAgent(event, config)) {
          console.log(`[DATABASE-DISPATCHER] 🎯 Triggering agent ${agentId} (${agent.name})`);
          
          await this.executeDatabaseTriggeredTask(agent, event, config);
        }
      } catch (error) {
        console.error(`[DATABASE-DISPATCHER] ❌ Error processing event for agent ${agentId}:`, error);
      }
    }
  }

  /**
   * Check if an agent should be triggered by a database event
   */
  private shouldTriggerAgent(event: DatabaseEventPayload, config: DatabaseEventConfig): boolean {
    // Check operation type
    if (!config.operations.includes(event.operation)) {
      return false;
    }

    // Check table if specified (for dynamic tables, we might need to map table_id to actual table name)
    if (config.table_id && !event.table_name.includes(config.table_id)) {
      return false;
    }

    // Additional conditions can be checked here
    if (config.conditions) {
      // Implement condition checking logic based on event data
      // For now, just return true if conditions exist
    }

    return true;
  }

  /**
   * Execute a task triggered by a database event
   */
  private async executeDatabaseTriggeredTask(
    agent: any, 
    event: DatabaseEventPayload, 
    config: DatabaseEventConfig
  ): Promise<void> {
    const instructions = `Database ${event.operation} event detected on ${event.table_name}. Process the change according to your configuration.`;
    
    const taskRequest: TaskCreationRequest = {
      agentId: agent.id,
      instructions,
      triggerType: 'DATABASE_EVENT',
      metadata: {
        event: event,
        config: config,
        triggeredAt: new Date().toISOString()
      }
    };

    try {
      const result = await taskExecutionPipeline.createAndExecuteTask(taskRequest);
      
      if (result.success) {
        console.log(`[DATABASE-DISPATCHER] ✅ Database task ${result.taskId.substring(0, 8)} completed for agent ${agent.id}`);
      } else {
        console.log(`[DATABASE-DISPATCHER] ❌ Database task ${result.taskId.substring(0, 8)} failed for agent ${agent.id}: ${result.error}`);
      }
    } catch (error) {
      console.error(`[DATABASE-DISPATCHER] ❌ Error executing database task for agent ${agent.id}:`, error);
    }
  }

  /**
   * Process a newly created task (special handling for tasks table)
   */
  private async processNewTask(taskData: any): Promise<void> {
    try {
      console.log(`[DATABASE-DISPATCHER] 📝 New task detected: ${taskData.id.substring(0, 8)} for agent ${taskData.agent_id}`);
      
      // Execute the task using the pipeline
      const result = await taskExecutionPipeline.executeExistingTask(taskData.id);
      
      if (result.success) {
        console.log(`[DATABASE-DISPATCHER] ✅ Auto-executed task ${taskData.id.substring(0, 8)}`);
      } else {
        console.log(`[DATABASE-DISPATCHER] ❌ Failed to auto-execute task ${taskData.id.substring(0, 8)}: ${result.error}`);
      }
    } catch (error) {
      console.error(`[DATABASE-DISPATCHER] ❌ Error processing new task ${taskData.id?.substring(0, 8)}:`, error);
    }
  }

  /**
   * Reload agents (called when agent configurations change)
   */
  async reloadAgents(): Promise<void> {
    console.log('[DATABASE-DISPATCHER] 🔄 Reloading database event agents...');
    await this.loadDatabaseEventAgents();
  }
}

// Global database dispatcher instance
export const databaseDispatcher = new DatabaseDispatcher();