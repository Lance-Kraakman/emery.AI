import type { 
  IAgentExecutionRepository, 
  AgentExecutionRequest, 
  AgentExecutionResult, 
  ExecutionStatus, 
  WorkerHealth 
} from '@/src/ddd/domain/agents/repositories/agent-execution-repository';
import type { IAgentRepository } from '@/src/ddd/domain/agents/repositories/agent-repository';
import { workerRegistry } from '@/src/lib/grpc/client';
import type { TaskProgress } from '@/src/lib/grpc/client';
import { createTaskRequest, mapTaskProgressFromProto, type AgentData } from '@/src/lib/grpc/proto-mappers';
import { getAgentDisplayName, getCapabilitiesCount } from '@/src/ddd/domain/agents/entities/agent';
import { AgentId, UserId, OrganizationId, TaskStatus, ApiKey } from '@/src/ddd/domain/shared/value-objects';
import { ToolConfig } from '@/src/ddd/domain/tools/value-objects/tool-config';

export class GrpcAgentExecutionRepository implements IAgentExecutionRepository {
  // Track active executions for status queries
  private activeExecutions = new Map<string, ExecutionStatus>();

  constructor(
    private readonly agentRepository: IAgentRepository
  ) {}

  /**
   * Execute agent via gRPC worker
   */
  async executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const { agentId, instructions, tools, servers, executionId, organizationId, timeoutSeconds, onProgress } = request;

    console.log(`[GRPC-EXECUTION-REPO] Starting execution ${executionId} for agent ${agentId}: "${instructions.substring(0, 100)}..."`);
    
    try {
      // 1. Load agent configuration (delegated to agent repository)
      const agent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // 2. Determine organization context
      const targetOrganizationId = organizationId || agent.organizationId;
      const organizationIdStr = targetOrganizationId.toString();
      
      console.log(`[GRPC-EXECUTION-REPO] Using agent: ${getAgentDisplayName(agent)} with ${getCapabilitiesCount(agent)} capabilities`);
      
      // 3. Get worker client for organization
      const workerClient = workerRegistry.getWorkerForOrganization(organizationIdStr);
      
      // 4. Create proto task request
      const taskRequest = createTaskRequest({
        taskId: executionId,
        agentId: agent.id.value,
        instructionConfig: {
          instructions,
          tools: (tools || []).map(tool =>
            tool instanceof ToolConfig ? tool : ToolConfig.fromPlain(tool)
          ),
          servers: servers || []
        },
        agent: agent,
        triggerData: {}, // Empty for proto compatibility
        organizationId: organizationIdStr,
        ownerId: agent.ownerId.value,
        timeoutSeconds: timeoutSeconds || 300
      });
      
      // 5. Initialize execution tracking
      let finalStatus: 'completed' | 'failed' | 'in_progress' = 'in_progress';
      let finalOutputData: any = null;
      let finalError: string | null = null;
      const startedAt = new Date();
      let completedAt: Date | undefined;
      
      // Update active executions map
      this.activeExecutions.set(executionId, {
        executionId,
        status: 'in_progress',
        progress: 0,
        startedAt
      });
      
      // 6. Execute task via gRPC with streaming progress updates
      await workerClient.executeTask(taskRequest as any, async (progress: TaskProgress) => {
        console.log(`[GRPC-EXECUTION-REPO] ${executionId}: Step ${progress.step_id} - Status: ${progress.status} (${progress.progress_percent}%)`);

        // DEBUG: Log full TaskProgress object
        console.log(`[GRPC-DEBUG] TaskProgress received:`, JSON.stringify(progress, null, 2));
        console.log(`[GRPC-DEBUG] output_json content:`, progress.output_json);
        console.log(`[GRPC-DEBUG] step_id:`, progress.step_id);
        console.log(`[GRPC-DEBUG] step_type:`, progress.step_type);

        // Create log message from TaskProgress
        const logMessage = `Step ${progress.step_id} (${progress.step_type}): ${progress.status} - ${progress.progress_percent}% ${progress.output_json ? `| Output: ${progress.output_json.substring(0, 200)}${progress.output_json.length > 200 ? '...' : ''}` : ''}${progress.error_message ? ` | Error: ${progress.error_message}` : ''}`;

        console.log(`[GRPC-DEBUG] Formatted log message:`, logMessage);

        // Send log to callback if provided
        if (onProgress) {
          console.log(`[GRPC-DEBUG] Calling onProgress callback`);
          onProgress(logMessage);
        } else {
          console.log(`[GRPC-DEBUG] No onProgress callback provided`);
        }

        // Map proto progress to TypeScript types
        const taskUpdate = mapTaskProgressFromProto(progress);
        
        // Calculate completion time for terminal states
        const isTerminal = ['completed', 'failed', 'cancelled'].includes(taskUpdate.status?.value || '');
        const calculatedCompletedAt = isTerminal ? new Date() : undefined;
        
        // Update execution tracking
        this.activeExecutions.set(executionId, {
          executionId,
          status: (taskUpdate.status?.value as ExecutionStatus['status']) || 'in_progress',
          progress: progress.progress_percent,
          currentStep: progress.step_id,
          result: taskUpdate.result,
          error: taskUpdate.error,
          startedAt,
          completedAt: calculatedCompletedAt
        });
        
        // Update final status based on progress
        if (taskUpdate.status?.value === 'completed') {
          console.log(`[GRPC-EXECUTION-REPO] ${executionId}: Task COMPLETED!`);
          finalStatus = 'completed';
          finalOutputData = taskUpdate.result;
          completedAt = new Date();
        } else if (taskUpdate.status?.value === 'failed') {
          console.log(`[GRPC-EXECUTION-REPO] ${executionId}: Task FAILED!`);
          finalStatus = 'failed';
          finalError = taskUpdate.error || 'Task failed';
          completedAt = new Date();
        }
      });
      
      // 7. Ensure finalStatus was properly set, default to failed if still in_progress
      if (finalStatus === 'in_progress') {
        console.warn(`[GRPC-EXECUTION-REPO] ${executionId}: Execution finished but status still in_progress, setting to failed`);
        finalStatus = 'failed';
        finalError = 'Task execution did not complete properly';
        completedAt = new Date();
      }
      
      // 8. Clean up execution tracking and return result
      this.activeExecutions.delete(executionId);
      
      console.log(`[GRPC-EXECUTION-REPO] Execution ${executionId} completed with status: ${finalStatus}`);
      
      return {
        success: (finalStatus as string) === 'completed',
        executionId,
        status: finalStatus as AgentExecutionResult['status'],
        outputData: finalOutputData,
        error: finalError || undefined,
        startedAt,
        completedAt
      };
      
    } catch (error) {
      console.error(`[GRPC-EXECUTION-REPO-ERROR] ${executionId}:`, error);
      
      // Clean up tracking and return error result
      this.activeExecutions.delete(executionId);
      
      return {
        success: false,
        executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        startedAt: new Date(),
        completedAt: new Date()
      };
    }
  }

  /**
   * Cancel execution via gRPC
   */
  async cancelExecution(executionId: string, reason?: string): Promise<void> {
    console.log(`[GRPC-EXECUTION-REPO] Cancelling execution ${executionId}: ${reason || 'No reason provided'}`);
    
    try {
      // Get execution info to determine organization
      const executionStatus = this.activeExecutions.get(executionId);
      if (!executionStatus) {
        console.warn(`[GRPC-EXECUTION-REPO] No active execution found for ${executionId}`);
        return;
      }

      // For now, we can't determine which organization to cancel on
      // Store execution tracking with organization context in the future
      // TODO: Improve by storing organization context in execution tracking
      console.log(`[GRPC-EXECUTION-REPO] Cancel requested for ${executionId}, but cannot determine organization - need to improve tracking`);
      
      // For now, just remove from tracking (execution may continue on worker)
      this.activeExecutions.delete(executionId);

      // Update execution status
      this.activeExecutions.set(executionId, {
        ...executionStatus,
        status: 'cancelled',
        error: `Cancelled: ${reason || 'User requested cancellation'}`,
        completedAt: new Date()
      });
      
    } catch (error) {
      console.error(`[GRPC-EXECUTION-REPO] Error cancelling execution ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution status from tracking map
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionStatus | null> {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * Get worker health for organization
   */
  async getWorkerHealth(organizationId: string): Promise<WorkerHealth> {
    try {
      const workerClient = workerRegistry.getWorkerForOrganization(organizationId);
      const workerInfo = await workerClient.getWorkerInfo();
      
      return {
        healthy: true,
        organizationId,
        workerId: workerInfo.worker_id || 'unknown',
        activeTasks: workerInfo.active_tasks || 0,
        maxConcurrentTasks: workerInfo.max_concurrent_tasks || 10,
        uptime: parseInt(workerInfo.uptime_seconds || '0', 10)
      };
    } catch (error) {
      console.error(`[GRPC-EXECUTION-REPO] Error getting worker health for org ${organizationId}:`, error);
      return {
        healthy: false,
        organizationId,
        workerId: 'unknown',
        activeTasks: 0,
        maxConcurrentTasks: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if execution is available for organization
   */
  async isExecutionAvailable(organizationId: string): Promise<boolean> {
    try {
      const health = await this.getWorkerHealth(organizationId);
      return health.healthy;
    } catch (error) {
      console.error(`[GRPC-EXECUTION-REPO] Error checking execution availability for org ${organizationId}:`, error);
      return false;
    }
  }
}