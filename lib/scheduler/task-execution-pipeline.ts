/**
 * Unified Task Execution Pipeline
 * Handles task creation and immediate execution for all trigger types
 */

import { db } from '@/lib/db/client';
import { tasks, agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { executeAgentViaGRPC } from '@/lib/agents/grpc-executor';
import { v4 as uuidv4 } from 'uuid';
import type { ToolConfig, ServerConfig } from '@/app/actions/types';

export interface TaskCreationRequest {
  agentId: number;
  instructions: string;
  triggerType: 'MANUAL' | 'DATABASE_EVENT' | 'CALENDAR';
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  metadata?: Record<string, any>;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  status: string;
  error?: string;
}

export class TaskExecutionPipeline {
  /**
   * Create and immediately execute a task
   * AIDEV-NOTE: Single entry point for all trigger types
   */
  async createAndExecuteTask(request: TaskCreationRequest): Promise<TaskExecutionResult> {
    const taskId = uuidv4();
    
    try {
      console.log(`[PIPELINE] 🚀 Creating task ${taskId.substring(0, 8)} for agent ${request.agentId} (${request.triggerType})`);
      
      // 1. Validate agent exists
      const [agent] = await db.select().from(agents).where(eq(agents.id, request.agentId)).limit(1);
      if (!agent) {
        throw new Error(`Agent ${request.agentId} not found`);
      }

      // 2. Create task record
      await db.insert(tasks).values({
        id: taskId,
        agentId: request.agentId,
        organizationId: agent.organizationId!, // Get from agent for RLS
        name: `${request.triggerType}: ${request.instructions.substring(0, 50)}...`,
        capabilityName: null, // Determined by smolagents
        instructions: {
          instructions: request.instructions,
          tools: request.tools || [],
          servers: request.servers || [],
          metadata: {
            triggerType: request.triggerType,
            ...request.metadata
          }
        },
        status: 'pending',
        createdBy: agent.ownerId,
      });

      console.log(`[PIPELINE] ✅ Task ${taskId.substring(0, 8)} created, executing immediately...`);

      // 3. Execute immediately via gRPC
      const result = await executeAgentViaGRPC({
        agentId: request.agentId,
        instructions: request.instructions,
        tools: request.tools,
        servers: request.servers,
        executionId: taskId
      });

      console.log(`[PIPELINE] 🏁 Task ${taskId.substring(0, 8)} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        taskId,
        success: result.success,
        status: result.status,
        error: result.error
      };

    } catch (error) {
      console.error(`[PIPELINE] ❌ Task ${taskId.substring(0, 8)} failed:`, error);
      
      // Update task status to failed
      try {
        await db.update(tasks)
          .set({
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            completedAt: new Date()
          })
          .where(eq(tasks.id, taskId));
      } catch (dbError) {
        console.error(`[PIPELINE] Failed to update task status:`, dbError);
      }

      return {
        taskId,
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Execute an existing pending task
   * AIDEV-NOTE: For cases where task was created but not executed immediately
   */
  async executeExistingTask(taskId: string): Promise<TaskExecutionResult> {
    try {
      // Get task details
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }

      if (task.status !== 'pending') {
        console.log(`[PIPELINE] ⚠️ Task ${taskId.substring(0, 8)} is not pending (status: ${task.status})`);
        return {
          taskId,
          success: false,
          status: task.status,
          error: `Task is not pending`
        };
      }

      console.log(`[PIPELINE] 🔄 Executing existing task ${taskId.substring(0, 8)}`);

      // Extract instructions from JSONB
      const instructionConfig = task.instructions as any;
      const instructions = instructionConfig?.instructions || 'Execute task';
      const tools = instructionConfig?.tools || [];
      const servers = instructionConfig?.servers || [];

      // Execute via gRPC
      const result = await executeAgentViaGRPC({
        agentId: task.agentId,
        instructions,
        tools,
        servers,
        executionId: taskId
      });

      return {
        taskId,
        success: result.success,
        status: result.status,
        error: result.error
      };

    } catch (error) {
      console.error(`[PIPELINE] ❌ Failed to execute existing task ${taskId.substring(0, 8)}:`, error);
      return {
        taskId,
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Global pipeline instance
export const taskExecutionPipeline = new TaskExecutionPipeline();