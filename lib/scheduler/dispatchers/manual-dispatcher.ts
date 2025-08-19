/**
 * Manual Dispatcher - Handles immediate task execution from user actions
 * Uses PostgreSQL LISTEN/NOTIFY for real-time execution
 */

import { createNotificationClient, rawClient } from '@/lib/db/client';
import { taskExecutionPipeline } from '../task-execution-pipeline';
import type { ToolConfig, ServerConfig } from '@/app/actions/types';
import type postgres from 'postgres';

export interface ManualTaskRequest {
  taskId: string;
  agentId: number;
  instructions: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  userId?: string;
}

export class ManualDispatcher {
  private isListening = false;
  private notificationListener: postgres.Sql | null = null;

  /**
   * Start listening for manual task notifications
   */
  async start(): Promise<void> {
    if (this.isListening) {
      console.log('[MANUAL-DISPATCHER] Already listening');
      return;
    }

    try {
      console.log('[MANUAL-DISPATCHER] 🎧 Starting manual task listener...');
      
      // Create dedicated notification client using centralized configuration
      this.notificationListener = createNotificationClient();
      
      // Note: postgres.js automatically handles LISTEN when using .listen() method
      
      // Handle notifications using postgres.js listen pattern
      await this.notificationListener.listen('manual_task_created', async (payload: string) => {
        console.log(`[MANUAL-DISPATCHER] 🔔 Manual task notification received`);
        
        try {
          const taskRequest: ManualTaskRequest = JSON.parse(payload);
          await this.executeManualTask(taskRequest);
        } catch (error) {
          console.error('[MANUAL-DISPATCHER] ❌ Error processing manual task:', error);
        }
      });
      
      this.isListening = true;
      console.log('[MANUAL-DISPATCHER] ✅ Manual task listener started');
      
    } catch (error) {
      console.error('[MANUAL-DISPATCHER] ❌ Failed to start manual task listener:', error);
    }
  }

  /**
   * Stop listening for manual task notifications
   */
  async stop(): Promise<void> {
    if (!this.isListening) return;

    try {
      if (this.notificationListener) {
        await this.notificationListener`UNLISTEN manual_task_created`;
        await this.notificationListener.end();
        this.notificationListener = null;
      }
      
      this.isListening = false;
      console.log('[MANUAL-DISPATCHER] 🛑 Manual task listener stopped');
    } catch (error) {
      console.error('[MANUAL-DISPATCHER] ❌ Error stopping manual task listener:', error);
    }
  }

  /**
   * Execute a manual task immediately
   */
  private async executeManualTask(request: ManualTaskRequest): Promise<void> {
    console.log(`[MANUAL-DISPATCHER] 🚀 Executing existing manual task ${request.taskId} for agent ${request.agentId}`);
    
    try {
      // Execute the existing pending task instead of creating a new one
      const result = await taskExecutionPipeline.executeExistingTask(request.taskId);
      
      if (result.success) {
        console.log(`[MANUAL-DISPATCHER] ✅ Successfully executed task ${request.taskId.substring(0, 8)}`);
      } else {
        console.error(`[MANUAL-DISPATCHER] ❌ Failed to execute task ${request.taskId.substring(0, 8)}:`, result.error);
      }
    } catch (error) {
      console.error(`[MANUAL-DISPATCHER] ❌ Error executing manual task ${request.taskId.substring(0, 8)}:`, error);
    }
  }

  /**
   * Trigger a manual task (called from API endpoints)
   */
  static async triggerManualTask(request: ManualTaskRequest): Promise<void> {
    console.log(`[MANUAL-DISPATCHER] 📤 Triggering manual task for agent ${request.agentId}`);
    
    try {
      // Use shared rawClient for one-off notifications (from centralized client.ts)
      await rawClient`SELECT pg_notify(${'manual_task_created'}, ${JSON.stringify(request)})`;
      
      console.log(`[MANUAL-DISPATCHER] ✅ Manual task notification sent`);
      
    } catch (error) {
      console.error('[MANUAL-DISPATCHER] ❌ Error triggering manual task:', error);
      throw error;
    }
  }
}

// Global manual dispatcher instance
export const manualDispatcher = new ManualDispatcher();