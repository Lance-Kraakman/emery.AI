/**
 * Simplified gRPC-based agent execution system.
 * Uses smolagents hierarchy for all agent execution via gRPC worker instances.
 */

import { db } from '@/lib/db/client';
import { tasks, agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {  workerRegistry } from '@/lib/grpc/client';
import type { TaskProgress } from '@/lib/grpc/client';
import { createTaskRequest, mapTaskProgressFromProto, type AgentData } from '@/lib/grpc/proto-mappers';

export interface AgentExecutionRequest {
  agentId: number;
  instructions: string; // Main instruction text
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>; // Optional tools
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>; // Optional servers
  executionId: string;
}

export interface AgentExecutionResult {
  success: boolean;
  execution_id: string;
  status: string;
  output_data?: any;
  error?: string;
}

/**
 * Execute an agent via gRPC using simplified smolagents hierarchy.
 * 
 * All capability routing and step management handled by smolagents internally.
 */
export async function executeAgentViaGRPC(
  request: AgentExecutionRequest
): Promise<AgentExecutionResult> {
  const { agentId, instructions, tools, servers, executionId } = request;
  
  console.log(`[GRPC-AGENT] Starting execution ${executionId} for agent ${agentId}: "${instructions.substring(0, 100)}..."`);
  
  try {
    // Query full agent configuration from database
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    console.log(`[GRPC-AGENT] Loaded agent: ${agent.name} with ${Object.keys(agent.capabilities || {}).length} capabilities`);
    
    // Check if task already exists (for pending task processing)
    const [existingTask] = await db.select().from(tasks).where(eq(tasks.id, executionId)).limit(1);
    
    if (existingTask) {
      // Update existing pending task (from scheduler)
      console.log(`[GRPC-AGENT] ${executionId}: Updating existing pending task`);
      await db.update(tasks)
        .set({
          status: 'in_progress',
          startedAt: new Date(),
          instructions: { 
            instructions, 
            tools: tools || [], 
            servers: servers || []
          },
        })
        .where(eq(tasks.id, executionId));
    } else {
      // Create new task for direct executions
      console.log(`[GRPC-AGENT] ${executionId}: Creating new task record`);
      await db.insert(tasks).values({
        id: executionId,
        agentId: agent.id,
        organizationId: agent.organizationId!, // Get from agent for RLS
        name: `Agent execution: ${instructions.substring(0, 50)}...`,
        capabilityName: null, // Determined by smolagents
        instructions: { 
          instructions, 
          tools: tools || [], 
          servers: servers || []
        },
        status: 'in_progress',
        startedAt: new Date(),
        createdBy: agent.ownerId,
      });
    }
    
    // Get worker client for this agent's organization
    const organizationId = agent.organizationId?.toString() || 'default';
    const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
    
    // Create proto task request with full agent configuration
    const taskRequest = createTaskRequest({
      taskId: executionId,
      agentId: agent.id,
      instructionConfig: { 
        instructions, 
        tools: tools || [], 
        servers: servers || [] 
      },
      agent: agent as AgentData,
      triggerData: {}, // Empty object for proto compatibility
      organizationId: organizationId,
      ownerId: agent.ownerId!,
      timeoutSeconds: 300
    });
    
    let finalStatus = 'in_progress';
    let finalOutputData: any = null;
    let finalError: string | null = null;
    
    // Execute task via gRPC with streaming progress updates
    await workerClient.executeTask(taskRequest as any, async (progress: TaskProgress) => {
      console.log(`[GRPC-PROGRESS] ${executionId}: Step ${progress.step_id} - Status: ${progress.status} (${progress.progress_percent}%)`);
      
      // Map proto progress to TypeScript types
      const taskUpdate = mapTaskProgressFromProto(progress);
      
      // Update final status based on progress
      if (taskUpdate.status === 'completed') {
        console.log(`[GRPC-STATUS] ${executionId}: Task COMPLETED detected!`);
        finalStatus = 'completed';
        finalOutputData = taskUpdate.result;
      } else if (taskUpdate.status === 'failed') {
        console.log(`[GRPC-STATUS] ${executionId}: Task FAILED detected!`);
        finalStatus = 'failed';
        finalError = taskUpdate.error || 'Task failed';
      }
      
      // Update task status in database for real-time tracking
      await db.update(tasks)
        .set({
          status: taskUpdate.status || 'in_progress',
          result: taskUpdate.result,
          error: taskUpdate.error,
          completedAt: taskUpdate.completedAt,
        })
        .where(eq(tasks.id, executionId));
    });
    
    console.log(`[GRPC-AGENT] Execution ${executionId} completed with status: ${finalStatus}`);
    
    return {
      success: finalStatus === 'completed',
      execution_id: executionId,
      status: finalStatus,
      output_data: finalOutputData,
      error: finalError || undefined,
    };
    
  } catch (error) {
    console.error(`[GRPC-AGENT-ERROR] ${executionId}:`, error);
    
    // Update database with error
    try {
      await db.update(tasks)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        })
        .where(eq(tasks.id, executionId));
    } catch (dbError) {
      console.error(`[GRPC-AGENT-DB-ERROR] ${executionId}:`, dbError);
    }
    
    return {
      success: false,
      execution_id: executionId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get worker health information for an organization
 */
export async function getWorkerHealthForOrganization(organizationId: string): Promise<any> {
  try {
    const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
    const workerInfo = await workerClient.getWorkerInfo();
    
    return {
      success: true,
      worker_info: workerInfo,
    };
  } catch (error) {
    console.error(`[WORKER-HEALTH-ERROR] Organization ${organizationId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Cancel a running task via gRPC
 */
export async function cancelTaskViaGRPC(
  executionId: string, 
  organizationId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
    const response = await workerClient.cancelTask({
      task_id: executionId,
      reason: reason || 'Cancelled by user',
    });
    
    // Update database status
    if (response.success) {
      await db.update(tasks)
        .set({
          status: 'cancelled',
          error: `Cancelled: ${reason || 'User requested cancellation'}`,
          completedAt: new Date(),
        })
        .where(eq(tasks.id, executionId));
    }
    
    return response;
  } catch (error) {
    console.error(`[CANCEL-TASK-ERROR] ${executionId}:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}