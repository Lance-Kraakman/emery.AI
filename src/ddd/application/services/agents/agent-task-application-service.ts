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
import { Task, type TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import { isActiveAgent, getAgentDisplayName } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, TaskId, UserId, TaskStatus, TeamId } from '@/ddd/domain/shared/value-objects';

export interface CreateTaskRequest {
  agentId?: AgentId; // Optional - for direct agent assignment
  teamId?: TeamId; // Optional - for team assignment (agentId and teamId are mutually exclusive)
  name: string;
  instructions: TaskInstructions;
  capabilityName?: string;
  createdBy?: UserId;
  organizationId: OrganizationId;
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
    console.log(`[AGENT-TASK-SERVICE] Creating task: ${request.name}`);
    
    // Validate request - either agentId or teamId must be provided
    if (!request.agentId && !request.teamId) {
      throw new Error('Either agentId or teamId must be provided for task assignment');
    }
    
    if (request.agentId && request.teamId) {
      throw new Error('Cannot specify both agentId and teamId - they are mutually exclusive');
    }

    let agentId: AgentId;
    let organizationId: OrganizationId;

    if (request.agentId) {
      // Direct agent assignment
      agentId = request.agentId;
      const agent = await this.agentRepository.findById(agentId);
      if (!agent) {
        throw new Error(`Agent ${request.agentId.value} not found`);
      }

      if (!isActiveAgent(agent)) {
        throw new Error(`Agent ${request.agentId.value} is not active (status: ${agent.status})`);
      }

      organizationId = request.organizationId;
    } else {
      // Team assignment - for now, throw error since Task entity doesn't support teamId yet
      throw new Error('Team task assignment not yet implemented in Task entity');
    }
    
    // AIDEV-DEBUG: Log organization ID resolution to debug constraint violation
    console.log('[AGENT-TASK-SERVICE] Organization ID resolution:', {
      requestOrganizationId: request.organizationId,
      resolvedOrganizationId: organizationId,
      organizationIdType: typeof organizationId,
      requestName: request.name
    });

    // 3. Create task using domain entity
    const task = Task.create({
      agentId,
      organizationId,
      name: request.name,
      capabilityName: request.capabilityName,
      instructions: request.instructions,
      createdBy: request.createdBy,
      status: TaskStatus.pending()
    });

    // 4. Save task using create method
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

    console.log(`[AGENT-TASK-SERVICE] Created task ${task.id.value.toString().substring(0, 8)} for ${request.agentId ? `agent ${request.agentId.value}` : `team ${request.teamId?.value}`}`);
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
      await this.taskRepository.update(task.id, {
        status: task.status.value,
        startedAt: task.startedAt
      });

      // 4. Execute via execution repository
      const executionRequest: AgentExecutionRequest = {
        agentId: task.agentId.value,
        instructions: task.instructions.instructions,
        capabilityName: task.capabilityName, // Pass capability name for capability-based execution
        tools: task.instructions.tools,
        servers: task.instructions.servers,
        executionId: task.id.value,
        organizationId: task.organizationId.value,
        ownerId: agent.ownerId.value,
        timeoutSeconds,
        onProgress: (logMessage: string) => {
          console.log(`[TASK-DEBUG] onProgress callback called with:`, logMessage);
          console.log(`[TASK-DEBUG] Task logs count before append:`, task.logs.length);

          // Append log to task in real-time
          task.appendLog(logMessage);

          console.log(`[TASK-DEBUG] Task logs count after append:`, task.logs.length);
          console.log(`[TASK-DEBUG] Latest log entry:`, task.logs[task.logs.length - 1]);
        }
      };

      const executionResult = await this.executionRepository.executeAgent(executionRequest);

      // 5. Update task based on execution result (domain logic)
      if (executionResult.success) {
        task.complete(executionResult.outputData);
        
        // 6. RAG reindexing (TODO: Integrate with new task scheduling system)
        // AIDEV-NOTE: Auto reindexing will be handled by the new task scheduling system
        console.log(`[AGENT-TASK-SERVICE] Task ${taskId.substring(0, 8)} completed successfully for organization ${task.organizationId.value}`);
      } else {
        task.fail(executionResult.error || 'Execution failed');
      }

      // 7. Save final task state
      console.log(`[TASK-DEBUG] About to save task to database`);
      console.log(`[TASK-DEBUG] Final task logs count:`, task.logs.length);
      console.log(`[TASK-DEBUG] Final task logs:`, JSON.stringify(task.logs, null, 2));

      await this.taskRepository.update(task.id, {
        status: task.status.value,
        result: task.result,
        completedAt: task.completedAt,
        error: task.error,
        logs: task.logs
      });

      console.log(`[TASK-DEBUG] Task saved to database successfully`);

      console.log(`[AGENT-TASK-SERVICE] Completed task ${taskId.substring(0, 8)}: ${executionResult.success ? 'SUCCESS' : 'FAILED'}`);

      return {
        task,
        executionResult
      };

    } catch (error) {
      console.error(`[AGENT-TASK-SERVICE] Error executing task ${taskId.substring(0, 8)}:`, error);
      
      // Mark task as failed (domain logic)
      task.fail(error instanceof Error ? error.message : String(error));
      await this.taskRepository.update(task.id, {
        status: task.status.value,
        error: task.error,
        completedAt: task.completedAt
      });

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
    return await this.taskRepository.findByOrganization(OrganizationId.fromNumber(organizationId));
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
    return await this.taskRepository.findByStatus(TaskStatus.inProgress());
  }

  /**
   * Get recent tasks for organization (for dashboard)
   */
  async getRecentTasksForOrganization(organizationId: number, limit?: number): Promise<Task[]> {
    const tasks = await this.taskRepository.findByOrganization(OrganizationId.fromNumber(organizationId));
    // Sort by creation date (most recent first) and apply limit
    const sortedTasks = tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? sortedTasks.slice(0, limit) : sortedTasks;
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