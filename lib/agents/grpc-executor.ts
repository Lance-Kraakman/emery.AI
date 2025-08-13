/**
 * gRPC-based agent workflow execution system for NextJS.
 * Replaces subprocess execution with gRPC calls to worker instances.
 */

import { db } from '@/lib/db/client';
import { tasks, agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AgentWorkerClient, workerRegistry, TaskStatus, TaskStatusEnum, TaskRequest } from '@/lib/grpc/client';
import type { TaskProgress } from '@/lib/grpc/client';
import { createTaskRequest, mapTaskProgressFromProto, type AgentData } from '@/lib/grpc/proto-mappers';

export interface AgentCapabilityRequest {
  agentId: number; // Agent ID to load from database
  capabilityName?: string; // Optional - for direct capability execution
  instructionConfig?: { // Optional - for instruction-based execution with auto-routing
    instructions: string;
    tools: Array<{name: string, version?: string, config?: Record<string, any>}>;
    servers: Array<{name: string, endpoint?: string, config?: Record<string, any>}>;
  };
  triggerData: Record<string, any>;
  stepOverrides?: Array<Record<string, any>>;
  executionId: string;
}

export interface AgentCapabilityResult {
  success: boolean;
  execution_id: string;
  capability_name: string;
  status: string;
  output_data?: any;
  error?: string;
  step_executions?: Array<{
    step_id: string;
    step_type: string;
    status: string;
    output_data?: any;
    error_message?: string;
  }>;
}

/**
 * Execute an agent capability using gRPC worker instances.
 * 
 * This function:
 * 1. Gets worker client for agent's organization
 * 2. Creates task record in database  
 * 3. Calls gRPC ExecuteTask with streaming progress
 * 4. Updates database with real-time progress
 * 5. Returns final execution results
 */
export async function executeAgentCapabilityViaGRPC(
  request: AgentCapabilityRequest
): Promise<AgentCapabilityResult> {
  const { agentId, capabilityName, instructionConfig, triggerData, stepOverrides, executionId } = request;
  
  if (instructionConfig && !capabilityName) {
    console.log(`[GRPC-CAPABILITY] Starting instruction-based execution ${executionId} for agent ${agentId}: "${instructionConfig.instructions}"`);
  } else if (capabilityName) {
    console.log(`[GRPC-CAPABILITY] Starting execution ${executionId} for agent ${agentId} capability '${capabilityName}'`);
  } else {
    throw new Error('Either capabilityName or instructionConfig must be provided');
  }
  
  try {
    // Query full agent configuration from database
    const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    
    console.log(`[GRPC-CAPABILITY] Loaded agent: ${agent.name} with ${Object.keys(agent.capabilities || {}).length} capabilities`);
    
    // Prepare enhanced trigger data
    let taskInstructions = triggerData;
    
    if (instructionConfig) {
      // For instruction-based execution, enhance trigger data with instructions context
      taskInstructions = {
        ...triggerData,
        user_instructions: instructionConfig.instructions,
        available_tools: instructionConfig.tools,
        available_servers: instructionConfig.servers,
      };
      console.log(`[GRPC-CAPABILITY] Sending instruction-based request to backend for routing`);
    }
    
    // Record task start in database
    await db.insert(tasks).values({
      id: executionId,
      agentId: agent.id,
      name: instructionConfig ? `Instruction-based task: ${instructionConfig.instructions.substring(0, 50)}...` : `gRPC capability execution: ${capabilityName}`,
      capabilityName: capabilityName || null, // Will be determined by backend if null
      instructions: instructionConfig || { instructions: triggerData?.instructions || 'Direct capability execution' },
      status: 'in_progress',
      startedAt: new Date(),
      createdBy: agent.ownerId,
    });
    
    // Get worker client for this agent's organization
    const organizationId = agent.organizationId?.toString() || 'default';
    const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
    
    // Create proto task request with full agent configuration
    const taskRequest = createTaskRequest({
      taskId: executionId,
      agentId: agent.id,
      // Pass either capability name or instruction config - backend will handle routing
      capabilityName: capabilityName,
      instructionConfig: instructionConfig,
      agent: agent as AgentData,
      triggerData: taskInstructions,
      organizationId: organizationId,
      ownerId: agent.ownerId!,
      timeoutSeconds: 300 // 5 minutes default
    });
    
    console.log(`[GRPC-CAPABILITY] Sending full agent config with ${Object.keys(agent.capabilities || {}).length} capabilities`);
    
    // Track step executions for final result
    const stepExecutions: Array<{
      step_id: string;
      step_type: string;
      status: string;
      output_data?: any;
      error_message?: string;
    }> = [];
    
    let finalStatus = 'in_progress';
    let finalOutputData: any = null;
    let finalError: string | null = null;
    
    // Execute task via gRPC with streaming progress updates
    await workerClient.executeTask(taskRequest as any, async (progress: TaskProgress) => {
      console.log(`[GRPC-PROGRESS] ${executionId}: Step ${progress.step_id} - Status: ${progress.status} (${progress.progress_percent}%)`);
      
      // Map proto progress to TypeScript types
      const taskUpdate = mapTaskProgressFromProto(progress);
      
      // Add to step executions if this is a work step
      if (progress.step_id && progress.step_type && progress.step_id !== 'initialization') {
        stepExecutions.push({
          step_id: progress.step_id,
          step_type: progress.step_type,
          status: taskUpdate.status!,
          output_data: taskUpdate.result,
          error_message: progress.error_message || undefined
        });
      }
      
      // Update final status based on progress
      console.log(`[GRPC-STATUS-CHECK] ${executionId}: Task status: ${taskUpdate.status}`);
      
      if (taskUpdate.status === 'completed') {
        console.log(`[GRPC-STATUS] ${executionId}: Task COMPLETED detected!`);
        finalStatus = 'completed';
        finalOutputData = taskUpdate.result;
      } else if (taskUpdate.status === 'failed') {
        console.log(`[GRPC-STATUS] ${executionId}: Task FAILED detected!`);
        finalStatus = 'failed';
        finalError = taskUpdate.error || 'Task failed';
      } else if (taskUpdate.status === 'cancelled') {
        console.log(`[GRPC-STATUS] ${executionId}: Task CANCELLED detected!`);
        finalStatus = 'cancelled';
        finalError = taskUpdate.error || 'Task cancelled';
      } else if (taskUpdate.status === 'timeout') {
        console.log(`[GRPC-STATUS] ${executionId}: Task TIMEOUT detected!`);
        finalStatus = 'timeout';
        finalError = taskUpdate.error || 'Task timed out';
      }
      
      // Update task status in database for real-time tracking using mapped values
      await db.update(tasks)
        .set({
          status: taskUpdate.status || 'in_progress',
          result: taskUpdate.result,
          error: taskUpdate.error,
          completedAt: taskUpdate.completedAt,
        })
        .where(eq(tasks.id, executionId));
    });
    
    console.log(`[GRPC-CAPABILITY] Execution ${executionId} completed with status: ${finalStatus}`);
    
    return {
      success: finalStatus === 'completed',
      execution_id: executionId,
      capability_name: capabilityName || 'auto-routed',
      status: finalStatus,
      output_data: finalOutputData,
      error: finalError || undefined,
      step_executions: stepExecutions,
    };
    
  } catch (error) {
    console.error(`[GRPC-CAPABILITY-ERROR] ${executionId}:`, error);
    
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
      console.error(`[GRPC-CAPABILITY-DB-ERROR] ${executionId}:`, dbError);
    }
    
    return {
      success: false,
      execution_id: executionId,
      capability_name: capabilityName || 'unknown',
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      step_executions: [],
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
          status: 'cancelled', // Use proper 'cancelled' status
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

// AIDEV-NOTE: Capability routing logic moved to Python backend using smolagents
// The backend will handle intelligent capability selection based on instructions

// AIDEV-NOTE: This replaces subprocess execution with gRPC streaming calls
// AIDEV-TODO: Add connection pooling and retry logic for production use
// AIDEV-TODO: Implement proper service discovery for multi-tenant worker routing
// AIDEV-TODO: Add task execution metrics and monitoring
// AIDEV-TODO: Enhance capability routing with AI/ML-based semantic matching
