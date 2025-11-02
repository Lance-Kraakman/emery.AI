import type {
  IAgentExecutionRepository,
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionStatus,
  WorkerHealth
} from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { workerRegistry } from '@/lib/grpc/client';
import type { TaskProgress } from '@/lib/grpc/client';
import { createTaskRequest, mapTaskProgressFromProto, type AgentData } from '@/lib/grpc/proto-mappers';
import { getAgentDisplayName, type Agent } from '@/ddd/domain/agents/entities/agent';
import { AgentId, UserId, OrganizationId, TaskStatus, ApiKey } from '@/ddd/domain/shared/value-objects';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository } from '@/ddd/application/di/getters';

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
    const { agentId, instructions, skillName, tools, executionId, organizationId, timeoutSeconds, onProgress } = request;

    console.log(`[GRPC-EXECUTION-REPO] Starting execution ${executionId} for agent ${agentId}: "${instructions.substring(0, 100)}..."`);
    console.log(`[GRPC-EXECUTION-REPO-DEBUG] Capability routing:`, {
      skillName,
      skillNameType: typeof skillName,
      skillNameTruthy: !!skillName,
      skillNameLength: skillName?.length,
      willUseCapabilityMode: !!skillName
    });
    if (skillName) {
      console.log(`[GRPC-EXECUTION-REPO] Capability-based execution: ${skillName}`);
    } else {
      console.log(`[GRPC-EXECUTION-REPO] Instruction-based execution (no capability name)`);
    }

    try {
      // 1. Load agent configuration (delegated to agent repository)
      const agent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // 2. Determine organization context
      const targetOrganizationId = organizationId || agent.organizationId;
      const organizationIdStr = targetOrganizationId.toString();

      console.log(`[GRPC-EXECUTION-REPO] Using agent: ${getAgentDisplayName(agent)}`);

      // 3. Get worker client for organization
      const workerClient = workerRegistry.getWorkerForOrganization(organizationIdStr);

      // 4. Enrich agent with API key in tools (following chat pattern)
      const enrichedAgent = this.enrichAgentTools(agent);

      // 5. Create proto task request - use capability mode if skillName provided
      const taskRequest = skillName
        ? createTaskRequest({
            taskId: executionId,
            agentId: agent.id.value,
            skillName: skillName, // Use capability-based execution
            agent: enrichedAgent, // Use enriched agent with API key in tool configs
            triggerData: {}, // Empty for proto compatibility
            organizationId: organizationIdStr,
            ownerId: agent.ownerId.value,
            timeoutSeconds: timeoutSeconds || 300
          })
        : createTaskRequest({
            taskId: executionId,
            agentId: agent.id.value,
            instructionConfig: { // Use instruction-based execution
              instructions,
              tools: this.enrichTools((tools || []).map(tool =>
                tool instanceof ToolConfig ? tool : ToolConfig.fromPlain(tool)
              ), agent.apiKey?.value)
            },
            agent: enrichedAgent,
            triggerData: {}, // Empty for proto compatibility
            organizationId: organizationIdStr,
            ownerId: agent.ownerId.value,
            timeoutSeconds: timeoutSeconds || 300
          });

      // AIDEV-DEBUG: Log what we're actually sending to Python
      console.log('[GRPC-DEBUG] TaskRequest being sent:', JSON.stringify({
        taskId: taskRequest.taskId,
        agentId: taskRequest.agentId,
        skillName: taskRequest.skillName,
        hasInstructionConfig: !!taskRequest.instructionConfig,
        instructionConfig: taskRequest.instructionConfig,
        instructionsText: instructions,
        toolsCount: tools?.length || 0,
        organizationId: taskRequest.organizationId
      }, null, 2));

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
        console.log(`[GRPC-EXECUTION-REPO] ${executionId}: Status: ${progress.status} (${progress.progressPercent}%)`);

        // DEBUG: Log full TaskProgress object
        console.log(`[GRPC-DEBUG] TaskProgress received:`, JSON.stringify(progress, null, 2));
        console.log(`[GRPC-DEBUG] outputJson content:`, progress.outputJson);

        // Create log message from TaskProgress (simplified - no step info)
        const logMessage = `${progress.status} - ${progress.progressPercent}% ${progress.outputJson ? `| Output: ${progress.outputJson.substring(0, 200)}${progress.outputJson.length > 200 ? '...' : ''}` : ''}${progress.errorMessage ? ` | Error: ${progress.errorMessage}` : ''}`;

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
          progress: progress.progressPercent,
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

          // Record token usage for billing
          if (progress.tokenUsage) {
            const tokenUsage = progress.tokenUsage;
            const tokenUsageRepo = getTokenUsageRepository();
            const tokenUsageService = new TokenUsageApplicationService(tokenUsageRepo);

            const orgId = typeof targetOrganizationId === 'number'
              ? targetOrganizationId
              : targetOrganizationId.value;

            tokenUsageService.recordTokenUsage({
              organizationId: orgId,
              userId: agent.ownerId.value,
              agentId: agent.id.value,
              entityType: 'task' as const,
              entityId: executionId,
              modelName: tokenUsage.modelName,
              inputTokens: tokenUsage.inputTokens,
              outputTokens: tokenUsage.outputTokens,
              metadata: {
                taskName: skillName || 'instruction_based',
                skillName: skillName,
                success: true
              }
            }).catch((error) => {
              console.error('[GRPC-EXECUTION-REPO] Failed to record token usage:', error);
              // Don't fail the task execution if token recording fails
            });
          }
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

  /**
   * Enrich tools with agent API key (following chat pattern)
   * Adds api_key to tool.config for OAuth proxy authentication
   */
  private enrichTools(tools: ToolConfig[], agentApiKey?: string): ToolConfig[] {
    if (!agentApiKey) {
      return tools;
    }

    return tools.map(tool => {
      const config = tool.config as any;

      // If tool already has authentication, preserve it
      if (config.api_key || config.oauth_token) {
        return tool;
      }

      // Add API key with agent mode for OAuth proxy
      return tool.withConfig({
        ...config,
        api_key: agentApiKey,
        api_key_mode: 'agent'  // Agent mode uses agent owner's credentials
      });
    });
  }

  /**
   * Enrich agent with API key in all tool configs
   * AIDEV-NOTE: Skills are now in separate table, so this just returns agent unchanged
   * Tool enrichment for skills should happen when skills are queried separately
   */
  private enrichAgentTools(agent: Agent): Agent {
    // Skills are in separate table now, not embedded in Agent entity
    return agent;
  }
}