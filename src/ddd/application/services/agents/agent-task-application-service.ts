/**
 * Agent Task Application Service
 *
 * Orchestrates agent task operations using domain repositories and services.
 * Handles task creation, execution coordination, status tracking, and lifecycle management.
 *
 * AIDEV-NOTE: Application service using repository pattern for execution -
 * treats agent execution as a repository operation with pluggable implementations
 *
 * AIDEV-NOTE: Dependencies are injected via constructor to avoid direct container access.
 * SkillEnrichmentService uses lazy getter pattern because it's registered after agent services.
 */

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository, AgentExecutionRequest } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { Task } from '@/ddd/domain/tasks/entities/task';
import { isActiveAgent } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, TaskId, UserId, TaskStatus, TeamId } from '@/ddd/domain/shared/value-objects';
import type { CreateTaskDTO, ExecuteTaskDTO, TaskExecutionResultDTO, TaskDTO } from '@/app/dtos/task.dto';
import { taskToDTO } from '@/app/mappers/task-mapper';
import type { Result } from '@/ddd/domain/shared/result';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import { InstructionTemplateService } from '@/ddd/domain/tasks/services/instruction-template-service';
import type { EnrichedSkill, SkillEnrichmentService } from '@/ddd/application/services/skills/skill-enrichment-service';

const logger = createDebugLogger('AgentTaskService');

export class AgentTaskApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly executionRepository: IAgentExecutionRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly getSkillEnrichmentService: () => SkillEnrichmentService
  ) {}

  /**
   * Create a new task for an agent
   */
  async createTask(dto: CreateTaskDTO): Promise<Result<TaskDTO>> {
    try {
      logger.summary(`Creating task: ${dto.name}`);

      // Convert DTO to Value Objects
      const organizationId = OrganizationId.fromNumber(dto.organizationId);
      const createdBy = dto.createdBy ? UserId.fromString(dto.createdBy) : undefined;

      // Validate request - either agentId or teamId must be provided
      if (!dto.agentId && !dto.teamId) {
        return {
          success: false,
          error: 'Either agentId or teamId must be provided for task assignment'
        };
      }

      if (dto.agentId && dto.teamId) {
        return {
          success: false,
          error: 'Cannot specify both agentId and teamId - they are mutually exclusive'
        };
      }

      let agentId: AgentId;

      if (dto.agentId) {
        // Direct agent assignment
        agentId = AgentId.fromNumber(dto.agentId);
        const agent = await this.agentRepository.findById(agentId);
        if (!agent) {
          return {
            success: false,
            error: `Agent ${dto.agentId} not found`
          };
        }

        if (!isActiveAgent(agent)) {
          return {
            success: false,
            error: `Agent ${dto.agentId} is not active (status: ${agent.status})`
          };
        }
      } else {
        // Team assignment - for now, return error since Task entity doesn't support teamId yet
        return {
          success: false,
          error: 'Team task assignment not yet implemented in Task entity'
        };
      }

      // Create task using domain entity
      const task = Task.create({
        agentId,
        organizationId,
        name: dto.name,
        instructions: dto.instructions,
        skillId: dto.skillId, // Optional skill to execute
        createdBy,
        status: TaskStatus.pending()
      });

      // Save task using create method
      const taskData = {
        id: task.id.value,
        agentId: task.agentId?.value ?? null, // Handle nullable agentId
        organizationId: task.organizationId.value,
        name: task.name,
        instructions: task.instructions,
        skillId: task.skillId, // Optional skill to execute
        status: task.status.value,
        createdBy: task.createdBy?.value || null,
        createdAt: task.createdAt
      };
      const savedTask = await this.taskRepository.create(taskData);

      // Update the task object with the saved version
      Object.assign(task, savedTask);

      logger.summary(`Created task ${task.id.value.toString().substring(0, 8)} for agent ${dto.agentId}`);

      return {
        success: true,
        data: taskToDTO(task)
      };

    } catch (error) {
      logger.error('Error creating task:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task'
      };
    }
  }

  /**
   * Execute an existing pending task
   */
  async executeTask(dto: ExecuteTaskDTO): Promise<Result<TaskExecutionResultDTO>> {
    try {
      const { taskId, timeoutSeconds } = dto;

      logger.summary(`Executing task ${taskId.substring(0, 8)}`);

      // 1. Load and validate task
      const task = await this.taskRepository.findById(TaskId.fromString(taskId));
      if (!task) {
        return {
          success: false,
          error: `Task ${taskId} not found`
        };
      }
      logger.summary(`Loaded task ${JSON.stringify(task, null, 4)}`);

      if (!task.isPending) {
        return {
          success: false,
          error: `Task ${taskId} is not pending (status: ${task.status})`
        };
      }

      // 2. Load and validate agent (if agent-level task)
      // AIDEV-NOTE: Org-level tasks (agentId is null) require different execution path
      if (!task.agentId) {
        // TODO: Implement org-level task execution via TaskExecutor
        return {
          success: false,
          error: `Org-level task execution not yet implemented via this path. Use ProcessMessage with task_id.`
        };
      }

      const agent = await this.agentRepository.findById(task.agentId);
      if (!agent) {
        return {
          success: false,
          error: `Agent ${task.agentId.value} not found`
        };
      }

      if (!isActiveAgent(agent)) {
        return {
          success: false,
          error: `Agent ${task.agentId.value} is not active`
        };
      }

      // 3. Load organization model for model selection hierarchy
      const organization = await this.organizationRepository.findById(agent.organizationId);
      const organizationModel = organization?.defaultModel || undefined;
      const agentModel = agent.defaultModel || undefined;

      logger.summary(`Model selection: agentModel=${agentModel || 'none'}, orgModel=${organizationModel || 'none'}`);

      // 4. Start task execution (domain logic)
      task.start();
      await this.taskRepository.update(task.id, {
        status: task.status.value,
        startedAt: task.startedAt
      });

      // 5. Load skill if task references one
      let enrichedSkill: EnrichedSkill | null = null;
      if (task.skillId) {
        const skillEnrichmentService = this.getSkillEnrichmentService();
        enrichedSkill = await skillEnrichmentService.enrichSkill(task.skillId);
        if (enrichedSkill) {
          logger.summary(`Loaded skill for task execution: ${enrichedSkill.name} (${enrichedSkill.executionType})`);
        } else {
          logger.error(`Skill ${task.skillId} not found for task ${task.id.value}`);
        }
      }

      // 6. Expand template variables in instructions
      const expandedInstructions = InstructionTemplateService.expandTemplate(
        task.instructions.task,
        task.triggerContext
      );

      // 7. Extract skill inputs from task metadata (from automation inputMappings)
      const skillInputs = task.instructions.metadata?.skillInputs as Record<string, any> | undefined;
      if (skillInputs && Object.keys(skillInputs).length > 0) {
        logger.summary(`Passing ${Object.keys(skillInputs).length} skill inputs: ${Object.keys(skillInputs).join(', ')}`);
      }

      // 8. Execute via execution repository
      // AIDEV-NOTE: task.agentId is guaranteed non-null here (we return early if null above)
      const executionRequest: AgentExecutionRequest = {
        agentId: task.agentId!.value,
        instructions: expandedInstructions,
        tools: task.instructions.tools,
        executionId: task.id.value,
        organizationId: task.organizationId.value,
        ownerId: agent.ownerId.value,
        agentModel,
        organizationModel,
        timeoutSeconds,
        skill: enrichedSkill || undefined, // Pass enriched skill if present
        skillInputs, // Pass resolved skill inputs (from automation inputMappings)
        onProgress: (logMessage: string) => {
          task.appendLog(logMessage);
        }
      };

      try {
        const executionResult = await this.executionRepository.executeAgent(executionRequest);

        // 5. Update task based on execution result (domain logic)
        if (executionResult.success) {
          task.complete(executionResult.outputData);
          logger.summary(`Task ${taskId.substring(0, 8)} completed successfully`);
        } else {
          task.fail(executionResult.error || 'Execution failed');
        }

        logger.summary(`Completed task ${taskId.substring(0, 8)}: ${executionResult.success ? 'SUCCESS' : 'FAILED'}`);

        return {
          success: true,
          data: {
            task: taskToDTO(task),
            executionResult
          }
        };

      } finally {
        // 6. ALWAYS save final task state and logs, even if execution threw an exception
        await this.taskRepository.update(task.id, {
          status: task.status.value,
          result: task.result,
          completedAt: task.completedAt,
          error: task.error,
          logs: task.logs
        });
      }

    } catch (error) {
      logger.error('Error executing task', error);

      // Attempt to mark task as failed in database when exception occurs
      // Need to reload task since it might not be in scope
      try {
        const { taskId } = dto;
        const failedTask = await this.taskRepository.findById(TaskId.fromString(taskId));
        if (failedTask) {
          failedTask.fail(error instanceof Error ? error.message : 'Failed to execute task');
          await this.taskRepository.update(failedTask.id, {
            status: failedTask.status.value,
            error: failedTask.error,
            completedAt: failedTask.completedAt,
            logs: failedTask.logs
          });
        }
      } catch (updateError) {
        logger.error('Failed to update task status after error', updateError);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute task'
      };
    }
  }

  /**
   * Create and execute a task in one operation (convenience method)
   */
  async createAndExecuteTask(dto: CreateTaskDTO & { timeoutSeconds?: number }): Promise<Result<TaskExecutionResultDTO>> {
    // 1. Create task
    const createResult = await this.createTask(dto);
    if (!createResult.success) {
      return {
        success: false,
        error: createResult.error
      };
    }

    // 2. Execute immediately
    return await this.executeTask({
      taskId: createResult.data!.id,
      timeoutSeconds: dto.timeoutSeconds
    });
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string, reason?: string): Promise<void> {
    logger.summary(`Cancelling task ${taskId.substring(0, 8)}: ${reason || 'No reason provided'}`);
    
    // 1. Load task
    const task = await this.taskRepository.findById(TaskId.fromString(taskId));
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // 2. Cancel execution if running
    if (task.isRunning) {
      await this.executionRepository.cancelExecution(taskId, reason);
    }

    // 3. Update task status (domain logic)
    task.cancel(reason);
    await this.taskRepository.update(task.id, {
      status: task.status.value,
      error: task.error,
      completedAt: task.completedAt
    });

    logger.summary(`Cancelled task ${taskId.substring(0, 8)}`);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskDTO | null> {
    const task = await this.taskRepository.findById(TaskId.fromString(taskId));
    return task ? taskToDTO(task) : null;
  }

  /**
   * Get tasks for agent
   */
  async getTasksForAgent(agentId: number): Promise<TaskDTO[]> {
    const tasks = await this.taskRepository.findByAgentId(AgentId.fromNumber(agentId));
    return tasks.map(taskToDTO);
  }

  /**
   * Get tasks for organization
   */
  async getTasksForOrganization(organizationId: number): Promise<TaskDTO[]> {
    const tasks = await this.taskRepository.findByOrganization(OrganizationId.fromNumber(organizationId));
    return tasks.map(taskToDTO);
  }

  /**
   * Get pending tasks (for scheduler)
   */
  async getPendingTasks(limit?: number): Promise<TaskDTO[]> {
    const tasks = await this.taskRepository.findPendingTasks(limit);
    return tasks.map(taskToDTO);
  }

  /**
   * Get running tasks (for monitoring)
   */
  async getRunningTasks(): Promise<TaskDTO[]> {
    const tasks = await this.taskRepository.findByStatus(TaskStatus.inProgress());
    return tasks.map(taskToDTO);
  }

  /**
   * Get recent tasks for organization (for dashboard)
   */
  async getRecentTasksForOrganization(organizationId: number, limit?: number): Promise<TaskDTO[]> {
    const tasks = await this.taskRepository.findByOrganization(OrganizationId.fromNumber(organizationId));
    // Sort by creation date (most recent first) and apply limit
    const sortedTasks = tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const limitedTasks = limit ? sortedTasks.slice(0, limit) : sortedTasks;
    return limitedTasks.map(taskToDTO);
  }

  /**
   * Check if agent execution is available for organization
   */
  async isExecutionAvailable(organizationId: number): Promise<boolean> {
    return await this.executionRepository.isExecutionAvailable(organizationId.toString());
  }

  /**
   * Get execution worker health for organization
   */
  async getWorkerHealth(organizationId: number) {
    return await this.executionRepository.getWorkerHealth(organizationId.toString());
  }
}