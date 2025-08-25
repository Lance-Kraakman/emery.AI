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
import type { ITaskRepository } from '@/ddd/domain/agents/repositories/task-repository';
import type { IAgentExecutionRepository, AgentExecutionRequest } from '@/ddd/domain/agents/repositories/agent-execution-repository';
import { Task, type TaskInstructions } from '@/ddd/domain/agents/entities/task';
import { isActiveAgent, getAgentDisplayName } from '@/ddd/domain/agents/entities/agent';
import { autoReindexService } from '@/ddd/application/di/rag-container';
import { AgentId, OrganizationId, TaskId, UserId, TaskStatus } from '@/ddd/domain/shared/value-objects';

export interface CreateTaskRequest {
  agentId: number; // Will be converted to AgentId in application service
  name: string;
  instructions: TaskInstructions;
  capabilityName?: string;
  createdBy?: string;
  organizationId?: number; // Optional override, will be converted to OrganizationId
}

export interface ExecuteTaskRequest {
  taskId: string;
  timeoutSeconds?: number;
}

export interface TaskExecutionResult {
  task: Task;
  executionResult: {
    success: boolean;
    executionId: string;
    status: string;
    outputData?: any;
    error?: string;
  };
}

export class AgentTaskApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly executionRepository: IAgentExecutionRepository
  ) {}

  /**
   * Create a new task for an agent
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    console.log(`[AGENT-TASK-SERVICE] Creating task for agent ${request.agentId}: ${request.name}`);
    
    // 1. Validate agent exists and is active
    const agentId = AgentId.fromNumber(request.agentId);
    const agent = await this.agentRepository.findById(agentId);
    if (!agent) {
      throw new Error(`Agent ${request.agentId} not found`);
    }

    if (!isActiveAgent(agent)) {
      throw new Error(`Agent ${request.agentId} is not active (status: ${agent.status})`);
    }

    // 2. Use agent's organization or override
    const organizationId = request.organizationId 
      ? OrganizationId.fromNumber(request.organizationId) 
      : agent.organizationId;
    
    // AIDEV-DEBUG: Log organization ID resolution to debug constraint violation
    console.log('[AGENT-TASK-SERVICE] Organization ID resolution:', {
      requestOrganizationId: request.organizationId,
      agentOrganizationId: agent.organizationId,
      resolvedOrganizationId: organizationId,
      organizationIdType: typeof organizationId,
      agentName: agent.name,
      requestName: request.name
    });

    // 3. Create task using domain entity
    const task = Task.create({
      agentId,
      organizationId,
      name: request.name,
      capabilityName: request.capabilityName,
      instructions: request.instructions,
      createdBy: request.createdBy ? UserId.fromString(request.createdBy) : undefined,
      status: TaskStatus.pending()
    });

    // 4. Save task
    await this.taskRepository.save(task);

    console.log(`[AGENT-TASK-SERVICE] Created task ${task.id.value.toString().substring(0, 8)} for agent ${getAgentDisplayName(agent)}`);
    return task;
  }

  /**
   * Execute an existing pending task
   */
  async executeTask(request: ExecuteTaskRequest): Promise<TaskExecutionResult> {
    const { taskId, timeoutSeconds } = request;
    
    console.log(`[AGENT-TASK-SERVICE] Executing task ${taskId.substring(0, 8)}`);
    
    // 1. Load and validate task
    const task = await this.taskRepository.findById(TaskId.fromString(taskId));
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!task.isPending) {
      throw new Error(`Task ${taskId} is not pending (status: ${task.status})`);
    }

    // 2. Load and validate agent
    const agent = await this.agentRepository.findById(task.agentId);
    if (!agent) {
      throw new Error(`Agent ${task.agentId} not found`);
    }

    if (!isActiveAgent(agent)) {
      throw new Error(`Agent ${task.agentId} is not active`);
    }

    try {
      // 3. Start task execution (domain logic)
      task.start();
      await this.taskRepository.save(task);

      // 4. Execute via execution repository
      const executionRequest: AgentExecutionRequest = {
        agentId: task.agentId.value,
        instructions: task.instructions.instructions,
        tools: task.instructions.tools,
        servers: task.instructions.servers,
        executionId: task.id.value,
        organizationId: task.organizationId.value,
        ownerId: agent.ownerId.value,
        timeoutSeconds
      };

      const executionResult = await this.executionRepository.executeAgent(executionRequest);

      // 5. Update task based on execution result (domain logic)
      if (executionResult.success) {
        task.complete(executionResult.outputData);
        
        // 6. Trigger RAG reindexing for successful task completions
        // AIDEV-NOTE: Automatically reindex organization data when agent tasks complete
        try {
          console.log(`[AGENT-TASK-SERVICE] Triggering RAG reindexing for organization ${task.organizationId} after successful task completion`);
          await autoReindexService.debouncedReindex(task.organizationId.value, 'agent', 5000);
        } catch (ragError) {
          console.error(`[AGENT-TASK-SERVICE] Error triggering RAG reindexing for task ${taskId.substring(0, 8)}:`, ragError);
          // Don't fail the task if RAG reindexing fails
        }
      } else {
        task.fail(executionResult.error || 'Execution failed');
      }

      // 7. Save final task state
      await this.taskRepository.save(task);

      console.log(`[AGENT-TASK-SERVICE] Completed task ${taskId.substring(0, 8)}: ${executionResult.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        task,
        executionResult
      };

    } catch (error) {
      console.error(`[AGENT-TASK-SERVICE] Error executing task ${taskId.substring(0, 8)}:`, error);
      
      // Mark task as failed (domain logic)
      task.fail(error instanceof Error ? error.message : String(error));
      await this.taskRepository.save(task);

      throw error;
    }
  }

  /**
   * Create and execute a task in one operation (convenience method)
   */
  async createAndExecuteTask(request: CreateTaskRequest & { timeoutSeconds?: number }): Promise<TaskExecutionResult> {
    // 1. Create task
    const task = await this.createTask(request);
    
    // 2. Execute immediately (includes automatic RAG reindexing on success)
    return await this.executeTask({
      taskId: task.id.value,
      timeoutSeconds: request.timeoutSeconds
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
    await this.taskRepository.save(task);

    console.log(`[AGENT-TASK-SERVICE] Cancelled task ${taskId.substring(0, 8)}`);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    return await this.taskRepository.findById(TaskId.fromString(taskId));
  }

  /**
   * Get tasks for agent
   */
  async getTasksForAgent(agentId: number): Promise<Task[]> {
    return await this.taskRepository.findByAgentId(AgentId.fromNumber(agentId));
  }

  /**
   * Get tasks for organization
   */
  async getTasksForOrganization(organizationId: number): Promise<Task[]> {
    return await this.taskRepository.findByOrganizationId(OrganizationId.fromNumber(organizationId));
  }

  /**
   * Get pending tasks (for scheduler)
   */
  async getPendingTasks(limit?: number): Promise<Task[]> {
    return await this.taskRepository.findPendingTasks(limit);
  }

  /**
   * Get running tasks (for monitoring)
   */
  async getRunningTasks(): Promise<Task[]> {
    return await this.taskRepository.findRunningTasks();
  }

  /**
   * Get recent tasks for organization (for dashboard)
   */
  async getRecentTasksForOrganization(organizationId: number, limit?: number): Promise<Task[]> {
    return await this.taskRepository.findRecentByOrganization(OrganizationId.fromNumber(organizationId), limit);
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