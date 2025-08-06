/**
 * gRPC-based agent workflow execution system for NextJS.
 * Replaces subprocess execution with gRPC calls to worker instances.
 */

import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AgentWorkerClient, workerRegistry, TaskStatus, TaskStatusEnum } from '@/lib/grpc/client';

export interface AgentCapabilityRequest {
  agent: any; // Agent from database
  capabilityName: string;
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
  const { agent, capabilityName, triggerData, stepOverrides, executionId } = request;
  
  console.log(`[GRPC-CAPABILITY] Starting execution ${executionId} for agent ${agent.id} capability '${capabilityName}'`);
  
  try {
    // Record task start in database
    await db.insert(tasks).values({
      id: executionId,
      agentId: agent.id,
      name: `gRPC capability execution: ${capabilityName}`,
      capabilityName: capabilityName,
      status: 'in_progress',
      payload: triggerData,
      startedAt: new Date(),
      createdBy: agent.ownerId,
    });
    
    // Get worker client for this agent's organization
    const organizationId = agent.organizationId?.toString() || 'default';
    const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
    
    // Prepare gRPC task request
    const taskRequest = {
      task_id: executionId,
      agent_id: agent.id,
      capability_name: capabilityName,
      trigger_data_json: JSON.stringify(triggerData),
      organization_id: organizationId,
      owner_id: agent.ownerId,
      timeout_seconds: 300 // 5 minutes default
    };
    
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
    await workerClient.executeTask(taskRequest, async (progress) => {
      console.log(`[GRPC-PROGRESS] ${executionId}: Step ${progress.step_id} - ${progress.status} (${progress.progress_percent}%)`);
      
      // Parse output data if available
      let outputData = null;
      if (progress.output_json) {
        try {
          outputData = JSON.parse(progress.output_json);
        } catch (e) {
          console.warn(`[GRPC-PROGRESS] ${executionId}: Failed to parse output JSON:`, progress.output_json);
        }
      }
      
      // Add to step executions if this is a work step
      if (progress.step_id && progress.step_type && progress.step_id !== 'initialization') {
        stepExecutions.push({
          step_id: progress.step_id,
          step_type: progress.step_type,
          status: progress.status === TaskStatus.TASK_COMPLETED ? 'completed' : 
                  progress.status === TaskStatus.TASK_FAILED ? 'failed' : 'in_progress',
          output_data: outputData,
          error_message: progress.error_message || undefined
        });
      }
      
      // Update final status based on progress
      if (progress.status === TaskStatus.TASK_COMPLETED) {
        finalStatus = 'completed';
        finalOutputData = outputData;
      } else if (progress.status === TaskStatus.TASK_FAILED) {
        finalStatus = 'failed';
        finalError = progress.error_message || 'Task failed';
      }
      
      // Update task status in database for real-time tracking
      await db.update(tasks)
        .set({
          status: finalStatus === 'completed' ? 'completed' : 
                 finalStatus === 'failed' ? 'failed' : 'in_progress',
          result: finalStatus === 'completed' ? finalOutputData : undefined,
          error: finalError || undefined,
          completedAt: (finalStatus === 'completed' || finalStatus === 'failed') ? new Date() : undefined,
        })
        .where(eq(tasks.id, executionId));
    });
    
    console.log(`[GRPC-CAPABILITY] Execution ${executionId} completed with status: ${finalStatus}`);
    
    return {
      success: finalStatus === 'completed',
      execution_id: executionId,
      capability_name: capabilityName,
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
      capability_name: capabilityName,
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
          status: 'failed', // Use 'failed' for cancelled tasks
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

// AIDEV-NOTE: This replaces subprocess execution with gRPC streaming calls
// AIDEV-TODO: Add connection pooling and retry logic for production use
// AIDEV-TODO: Implement proper service discovery for multi-tenant worker routing
// AIDEV-TODO: Add task execution metrics and monitoring