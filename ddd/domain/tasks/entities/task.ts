/**
 * Task Domain Entity
 * 
 * Represents an agent execution task with its lifecycle and state.
 * Tasks are created when agents are executed and track progress/results.
 * 
 * AIDEV-NOTE: Domain entity for task management - contains business logic
 * for task lifecycle and status transitions with DDD Value Objects
 */

import type { ToolConfig, ServerConfig } from '@/ddd/domain/agents/entities/agent';
import { TaskId } from '../value-objects/task-id';
import { TaskStatus, TASK_STATUS } from '../value-objects/task-status';
import { 
  AgentId, 
  OrganizationId, 
  UserId
} from '@/ddd/domain/shared/value-objects';

// Re-export TaskStatus for external use
export { TaskStatus };

export interface TaskInstructions {
  instructions: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  metadata?: Record<string, any>;
}

export interface TaskConfig {
  id?: TaskId; // Will be generated if not provided
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  status?: TaskStatus;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: UserId;
  createdAt?: Date;
}

export interface CreateTaskData {
  agentId: AgentId;
  name: string;
  capabilityName?: string; // Optional - system can auto-route
  instructions: TaskInstructions; // Task configuration
  createdBy?: UserId;
}

export class Task {
  private constructor(
    public readonly id: TaskId,
    public readonly agentId: AgentId,
    public readonly organizationId: OrganizationId,
    public readonly name: string,
    public readonly capabilityName: string | null,
    public readonly instructions: TaskInstructions,
    private _status: TaskStatus,
    private _result: any | null,
    private _error: string | null,
    private _startedAt: Date | null,
    private _completedAt: Date | null,
    public readonly createdBy: UserId | null,
    public readonly createdAt: Date
  ) {}

  static create(config: TaskConfig): Task {
    const now = new Date();
    
    // AIDEV-NOTE: Value Objects provide built-in validation, no need for manual checks
    // Validate required Value Objects
    if (!config.organizationId) {
      throw new Error('Task creation failed: organizationId is required');
    }
    
    if (!config.agentId) {
      throw new Error('Task creation failed: agentId is required');
    }
    
    return new Task(
      config.id || TaskId.generate(),
      config.agentId,
      config.organizationId,
      config.name,
      config.capabilityName || null,
      config.instructions,
      config.status || TaskStatus.pending(),
      config.result || null,
      config.error || null,
      config.startedAt || null,
      config.completedAt || null,
      config.createdBy || null,
      config.createdAt || now
    );
  }

  static fromPersistence(data: {
    id: string;
    agentId: number;
    organizationId: number;
    name: string;
    capabilityName?: string | null;
    instructions: any; // JSONB from database
    status: string;
    result?: any;
    error?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdBy?: string | null;
    createdAt: Date;
  }): Task {
    return new Task(
      TaskId.fromString(data.id),
      AgentId.fromNumber(data.agentId),
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      data.capabilityName || null,
      data.instructions as TaskInstructions,
      TaskStatus.fromString(data.status),
      data.result || null,
      data.error || null,
      data.startedAt || null,
      data.completedAt || null,
      data.createdBy ? UserId.fromString(data.createdBy) : null,
      data.createdAt
    );
  }

  // Getters
  get status(): TaskStatus { return this._status; }
  get result(): any | null { return this._result; }
  get error(): string | null { return this._error; }
  get startedAt(): Date | null { return this._startedAt; }
  get completedAt(): Date | null { return this._completedAt; }

  /**
   * Start task execution
   */
  start(): void {
    if (!this._status.canStart()) {
      throw new Error(`Cannot start task ${this.id}: current status is ${this._status.value}`);
    }
    
    this._status = TaskStatus.inProgress();
    this._startedAt = new Date();
    this._error = null; // Clear any previous error
  }

  /**
   * Mark task as completed with result
   */
  complete(result?: any): void {
    if (!this._status.canTransitionTo(TaskStatus.completed())) {
      throw new Error(`Cannot complete task ${this.id}: current status is ${this._status.value}`);
    }
    
    this._status = TaskStatus.completed();
    this._result = result || null;
    this._completedAt = new Date();
    this._error = null; // Clear any error on success
  }

  /**
   * Mark task as failed with error
   */
  fail(error: string): void {
    if (!this._status.canTransitionTo(TaskStatus.failed())) {
      throw new Error(`Cannot fail task ${this.id}: current status is ${this._status.value}`);
    }
    
    this._status = TaskStatus.failed();
    this._error = error;
    this._completedAt = new Date();
  }

  /**
   * Cancel task execution
   */
  cancel(reason?: string): void {
    if (!this._status.canCancel()) {
      throw new Error(`Cannot cancel task ${this.id}: current status is ${this._status.value}`);
    }
    
    this._status = TaskStatus.cancelled();
    this._error = reason ? `Cancelled: ${reason}` : 'Cancelled by user';
    this._completedAt = new Date();
  }

  /**
   * Mark task as timed out
   */
  timeout(): void {
    if (this._status.value === TASK_STATUS.COMPLETED || this._status.value === TASK_STATUS.FAILED) {
      throw new Error(`Cannot timeout task ${this.id}: task is already ${this._status.value}`);
    }
    
    this._status = TaskStatus.failed(); // Use failed status for timeout
    this._error = 'Task execution timed out';
    this._completedAt = new Date();
  }

  /**
   * Update task result during execution (for progress tracking)
   */
  updateResult(result: any): void {
    if (this._status.value !== TASK_STATUS.IN_PROGRESS) {
      throw new Error(`Cannot update result for task ${this.id}: task is not in progress`);
    }
    
    this._result = result;
  }

  /**
   * Check if task is in a terminal state
   */
  get isTerminal(): boolean {
    return [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED].includes(this._status.value as any);
  }

  /**
   * Check if task is running
   */
  get isRunning(): boolean {
    return this._status.value === TASK_STATUS.IN_PROGRESS;
  }

  /**
   * Check if task is pending
   */
  get isPending(): boolean {
    return this._status.value === TASK_STATUS.PENDING;
  }

  /**
   * Get task duration in milliseconds (if completed)
   */
  get duration(): number | null {
    if (!this._startedAt || !this._completedAt) {
      return null;
    }
    return this._completedAt.getTime() - this._startedAt.getTime();
  }

  /**
   * Get task display name
   */
  get displayName(): string {
    return this.name.length > 50 ? `${this.name.substring(0, 47)}...` : this.name;
  }
}