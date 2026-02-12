import type {
  IAgentExecutionRepository,
  AgentExecutionRequest,
  AgentExecutionResult,
  ExecutionStatus,
  WorkerHealth
} from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { workerRegistry } from '@/ddd/infrastructure/grpc/client';
import type { TaskProgress } from '@/ddd/infrastructure/grpc/client';
import { createTaskRequest, mapTaskProgressFromProto, type ResolvedContextData, type ContextMappingData } from '@/ddd/infrastructure/grpc/proto-mappers';
import { getAgentDisplayName, type Agent } from '@/ddd/domain/agents/entities/agent';
import { AgentId } from '@/ddd/domain/shared/value-objects';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { TokenUsageApplicationService } from '@/ddd/application/services/billing/token-usage-application-service';
import { getTokenUsageRepository, getOrganizationRepository, getContextMappingApplicationService } from '@/ddd/application/di/getters';
import { createCallbackToken } from '@/lib/auth/token-service';
import type { ContextMapping } from '@/ddd/domain/context/entities/context-mapping';

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
    const { agentId, instructions, tools, executionId, organizationId, timeoutSeconds, onProgress, agentModel, organizationModel, skill, skillInputs } = request;

    console.log(`[GRPC-EXECUTION-REPO] Starting execution ${executionId} for agent ${agentId}: "${instructions.substring(0, 100)}..."`);
    console.log(`[GRPC-EXECUTION-REPO] Model selection: agentModel=${agentModel || 'none'}, orgModel=${organizationModel || 'none'}`);
    console.log(`[GRPC-EXECUTION-REPO] Skill execution: ${skill ? `${skill.name} (${skill.executionType})` : 'none'}`);
    if (skillInputs && Object.keys(skillInputs).length > 0) {
      console.log(`[GRPC-EXECUTION-REPO] Skill inputs: ${JSON.stringify(skillInputs)}`);
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

      // 5. Build typed skill inputs from raw values + skill input definitions
      // AIDEV-NOTE: Each SkillInputValue carries name, type, and the actual value in the appropriate oneof field
      const typedSkillInputs: Array<{ name: string; type: string; value: unknown }> = [];
      if (skillInputs && skill?.inputs) {
        for (const [name, value] of Object.entries(skillInputs)) {
          // Look up type from skill input definition
          const inputDef = skill.inputs.find(i => i.name === name);
          typedSkillInputs.push({
            name,
            type: inputDef?.type || 'text', // Default to 'text' if not found
            value
          });
        }
      }

      // Resolve numeric org ID once for use in context mappings and API key generation
      const orgId = typeof targetOrganizationId === 'number'
        ? targetOrganizationId
        : targetOrganizationId.value;

      // 5b. Resolve context table mappings for this execution
      // AIDEV-NOTE: Context tables define which dynamic tables are available to the agent
      // with specific access permissions (read/write/readwrite)
      let resolvedContext: ResolvedContextData | undefined;
      try {
        const contextMappingService = getContextMappingApplicationService();

        const resolved = await contextMappingService.resolveContextForExecution(
          orgId,
          agentId,
          skill?.id // skill ID if executing a skill
          // stepId would be added here for step-level context
        );

        // Convert domain ContextMapping to ContextMappingData for proto
        resolvedContext = {
          mappings: resolved.mappings.map(this.mapContextMappingToData),
          agentMappings: [], // Will be populated if needed
          skillMappings: [], // Will be populated if needed
          stepMappings: []   // Will be populated if needed
        };

        console.log(`[GRPC-EXECUTION-REPO] Resolved ${resolved.mappings.length} context table mappings for agent ${agentId}`);
      } catch (error) {
        console.warn(`[GRPC-EXECUTION-REPO] Failed to resolve context mappings, continuing without:`, error);
        // Context tables are optional - continue execution without them
      }

      // 6. Generate short-lived callback token for tool authentication
      const agentApiKey = await createCallbackToken(agent.ownerId.value, agent.id.value);

      // 7. Create proto task request
      // Use skill-based execution if skill is provided, otherwise instruction-based
      const taskRequest = createTaskRequest({
        taskId: executionId,
        agentId: agent.id.value,
        // If skill provided, use skill_name mode; otherwise use instruction_config mode
        ...(skill ? {
          skill: skill // Pass skill for skill_name mode execution
        } : {
          instructionConfig: { // Instruction-based execution with task instructions
            task: instructions,
            tools: this.enrichTools((tools || []).map(tool =>
              tool instanceof ToolConfig ? tool : ToolConfig.fromPlain(tool)
            ), agentApiKey)
          }
        }),
        agent: enrichedAgent,
        // Typed skill inputs from automation inputMappings
        // The worker extracts these in _create_skill_context() and passes to execute_skill(runtime_inputs=...)
        skillInputs: typedSkillInputs,
        organizationId: organizationIdStr,
        ownerId: agent.ownerId.value,
        timeoutSeconds: timeoutSeconds || 300,
        agentModel: agentModel || undefined, // Pass agent model for hierarchy
        organizationModel: organizationModel || undefined, // Pass organization model for hierarchy
        resolvedContext, // Context table mappings for this execution
        // Trigger context for audit trail (flows to Python worker → HTTP headers on tool calls)
        triggerType: request.triggerType,
        triggeredByUserId: request.triggeredByUserId,
        triggeredByUserName: request.triggeredByUserName,
        userApiKey: agentApiKey, // Fresh agent key for Python ToolProvider
      });


      // 5. Initialize execution tracking
      let finalStatus: 'completed' | 'failed' | 'in_progress' | 'awaiting_human' = 'in_progress';
      let finalOutputData: any = null;
      let finalError: string | null = null;
      let humanSkillData: AgentExecutionResult['humanSkillData'] = undefined;
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

        // Create log message from TaskProgress (simplified - no step info)
        const logMessage = `${progress.status} - ${progress.progressPercent}% ${progress.outputJson ? `| Output: ${progress.outputJson.substring(0, 200)}${progress.outputJson.length > 200 ? '...' : ''}` : ''}${progress.errorMessage ? ` | Error: ${progress.errorMessage}` : ''}`;

        // Send log to callback if provided
        if (onProgress) {
          onProgress(logMessage);
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
            const orgRepo = getOrganizationRepository();
            const tokenUsageService = new TokenUsageApplicationService(tokenUsageRepo, orgRepo);

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
                taskName: 'task_execution',
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
        } else if (taskUpdate.status?.value === 'awaiting_human') {
          console.log(`[GRPC-EXECUTION-REPO] ${executionId}: Task AWAITING HUMAN!`);
          finalStatus = 'awaiting_human';
          // Extract human skill data from the output
          if (taskUpdate.result?.type === 'awaiting_human_skill') {
            humanSkillData = {
              skillId: taskUpdate.result.skill_id,
              skillName: taskUpdate.result.skill_name,
              stepId: taskUpdate.result.step_id || '',
              instructions: taskUpdate.result.instructions,
              inputs: taskUpdate.result.inputs || {},
              outputSchema: taskUpdate.result.output_schema || [],
              assignedTo: taskUpdate.result.assigned_to || '',
            };
          }
        }
      });
      
      // 7. Ensure finalStatus was properly set, default to failed if still in_progress
      // Note: awaiting_human is a valid non-terminal status - don't treat it as failure
      if (finalStatus === 'in_progress') {
        console.warn(`[GRPC-EXECUTION-REPO] ${executionId}: Execution finished but status still in_progress, setting to failed`);
        finalStatus = 'failed';
        finalError = 'Task execution did not complete properly';
        completedAt = new Date();
      }

      // 8. Clean up execution tracking and return result
      this.activeExecutions.delete(executionId);

      // Re-capture final status for type safety after callback mutations
      const resultStatus = finalStatus as 'completed' | 'failed' | 'awaiting_human';
      console.log(`[GRPC-EXECUTION-REPO] Execution ${executionId} completed with status: ${resultStatus}`);

      // For awaiting_human, success is false but task is not failed - it's paused
      const success = resultStatus === 'completed';

      return {
        success,
        executionId,
        status: resultStatus as AgentExecutionResult['status'],
        outputData: finalOutputData,
        error: finalError || undefined,
        startedAt,
        completedAt,
        humanSkillData
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

  /**
   * Convert domain ContextMapping to ContextMappingData for proto transport
   */
  private mapContextMappingToData(mapping: ContextMapping): ContextMappingData {
    return {
      tableId: mapping.tableId.value,
      tableName: mapping.tableName,
      accessMode: mapping.accessMode as 'read' | 'write' | 'readwrite',
      syncMode: mapping.syncMode as 'on_access' | 'on_save' | 'realtime',
      targetType: mapping.targetType as 'agent' | 'skill' | 'skill_step',
      targetId: mapping.targetId
    };
  }
}