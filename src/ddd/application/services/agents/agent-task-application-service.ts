/**
 * Agent Task Application Service
 *
 * Orchestrates agent task operations using domain repositories and services.
 * Handles task creation, execution coordination, status tracking, and lifecycle management.
 *
 * AIDEV-NOTE: Application service using repository pattern for execution -
 * treats agent execution as a repository operation with pluggable implementations
 */

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { IAgentExecutionRepository, AgentExecutionRequest } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import { Task } from '@/ddd/domain/tasks/entities/task';
import { isActiveAgent } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, TaskId, UserId, TaskStatus, TeamId } from '@/ddd/domain/shared/value-objects';
import type { CreateTaskDTO, ExecuteTaskDTO, TaskExecutionResultDTO, TaskDTO } from '@/app/dtos/task.dto';
import { taskToDTO } from '@/app/mappers/task-mapper';
import type { Result } from '@/ddd/domain/shared/result';

export class AgentTaskApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly executionRepository: IAgentExecutionRepository
  ) {}

  /**
   * Create a new task for an agent
   */
  async createTask(dto: CreateTaskDTO): Promise<Result<TaskDTO>> {
    try {
      console.log(`[AGENT-TASK-SERVICE] Creating task: ${dto.name}`);

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
        capabilityName: dto.capabilityName,
        instructions: dto.instructions,
        createdBy,
        status: TaskStatus.pending()
      });

      // Save task using create method
      const taskData = {
        id: task.id.value,
        agentId: task.agentId.value,
        organizationId: task.organizationId.value,
        name: task.name,
        capabilityName: task.capabilityName || null,
        instructions: task.instructions,
        status: task.status.value,
        createdBy: task.createdBy?.value || null,
        createdAt: task.createdAt
      };
      const savedTask = await this.taskRepository.create(taskData);

      // Update the task object with the saved version
      Object.assign(task, savedTask);

      console.log(`[AGENT-TASK-SERVICE] Created task ${task.id.value.toString().substring(0, 8)} for agent ${dto.agentId}`);

      return {
        success: true,
        data: taskToDTO(task)
      };

    } catch (error) {
      console.error('[AGENT-TASK-SERVICE] Error creating task:', error);
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

      console.log(`[AGENT-TASK-SERVICE] Executing task ${taskId.substring(0, 8)}`);

      // 1. Load and validate task
      const task = await this.taskRepository.findById(TaskId.fromString(taskId));
      if (!task) {
        return {
          success: false,
          error: `Task ${taskId} not found`
        };
      }
      console.log(`[AGENT-TASK-SERVICE] Loaded task ${JSON.stringify(task, null, 4)}`);

      if (!task.isPending) {
        return {
          success: false,
          error: `Task ${taskId} is not pending (status: ${task.status})`
        };
      }

      // 2. Load and validate agent
      const agent = await this.agentRepository.findById(task.agentId);
      if (!agent) {
        return {
          success: false,
          error: `Agent ${task.agentId} not found`
        };
      }

      if (!isActiveAgent(agent)) {
        return {
          success: false,
          error: `Agent ${task.agentId} is not active`
        };
      }

      // 3. Start task execution (domain logic)
      task.start();
      await this.taskRepository.update(task.id, {
        status: task.status.value,
        startedAt: task.startedAt
      });

      // 4. Execute via execution repository
      const executionRequest: AgentExecutionRequest = {
        agentId: task.agentId.value,
        instructions: task.instructions.instructions,
        capabilityName: task.capabilityName || undefined,
        tools: task.instructions.tools,
        servers: task.instructions.servers,
        executionId: task.id.value,
        organizationId: task.organizationId.value,
        ownerId: agent.ownerId.value,
        timeoutSeconds,
        onProgress: (logMessage: string) => {
          task.appendLog(logMessage);
        }
      };

      const executionResult = await this.executionRepository.executeAgent(executionRequest);

      // 5. Update task based on execution result (domain logic)
      if (executionResult.success) {
        task.complete(executionResult.outputData);
        console.log(`[AGENT-TASK-SERVICE] Task ${taskId.substring(0, 8)} completed successfully`);
      } else {
        task.fail(executionResult.error || 'Execution failed');
      }

      // 6. Save final task state
      await this.taskRepository.update(task.id, {
        status: task.status.value,
        result: task.result,
        completedAt: task.completedAt,
        error: task.error,
        logs: task.logs
      });

      console.log(`[AGENT-TASK-SERVICE] Completed task ${taskId.substring(0, 8)}: ${executionResult.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        success: true,
        data: {
          task: taskToDTO(task),
          executionResult
        }
      };

    } catch (error) {
      console.error(`[AGENT-TASK-SERVICE] Error executing task:`, error);
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
    console.log(`[AGENT-TASK-SERVICE] Cancelling task ${taskId.substring(0, 8)}: ${reason || 'No reason provided'}`);
    
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

    console.log(`[AGENT-TASK-SERVICE] Cancelled task ${taskId.substring(0, 8)}`);
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