/**
 * Task Domain Entity
 * 
 * Represents an agent execution task with its lifecycle and state.
 * Tasks are created when agents are executed and track progress/results.
 * 
 * AIDEV-NOTE: Domain entity for task management - contains business logic
 * for task lifecycle and status transitions
 */

import type { ToolConfig, ServerConfig } from './agent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface TaskInstructions {
  instructions: string;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  metadata?: Record<string, any>;
}

export interface TaskConfig {
  id?: string; // UUID, will be generated if not provided
  agentId: number;
  organizationId: number;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  status?: TaskStatus;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: string;
  createdAt?: Date;
}

export interface CreateTaskData {
  agentId: number;
  name: string;
  capabilityName?: string; // Optional - system can auto-route
  instructions: TaskInstructions; // Task configuration
  createdBy?: string;
}

export class Task {
  private constructor(
    public readonly id: string,
    public readonly agentId: number,
    public readonly organizationId: number,
    public readonly name: string,
    public readonly capabilityName: string | null,
    public readonly instructions: TaskInstructions,
    private _status: TaskStatus,
    private _result: any | null,
    private _error: string | null,
    private _startedAt: Date | null,
    private _completedAt: Date | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date
  ) {}

  static create(config: TaskConfig): Task {
    const now = new Date();
    
    // AIDEV-DEBUG: Log task creation to debug organization_id issue
    console.log('[TASK-ENTITY] Creating task with config:', {
      agentId: config.agentId,
      organizationId: config.organizationId,
      organizationIdType: typeof config.organizationId,
      name: config.name
    });
    
    // Validate required fields to prevent NULL constraint violations
    if (!config.organizationId || typeof config.organizationId !== 'number') {
      throw new Error(`Task creation failed: organizationId is required and must be a number, got: ${config.organizationId} (${typeof config.organizationId})`);
    }
    
    if (!config.agentId || typeof config.agentId !== 'number') {
      throw new Error(`Task creation failed: agentId is required and must be a number, got: ${config.agentId} (${typeof config.agentId})`);
    }
    
    return new Task(
      config.id || crypto.randomUUID(),
      config.agentId,
      config.organizationId,
      config.name,
      config.capabilityName || null,
      config.instructions,
      config.status || 'pending',
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
      data.id,
      data.agentId,
      data.organizationId,
      data.name,
      data.capabilityName || null,
      data.instructions as TaskInstructions,
      data.status as TaskStatus,
      data.result || null,
      data.error || null,
      data.startedAt || null,
      data.completedAt || null,
      data.createdBy || null,
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
    if (this._status !== 'pending') {
      throw new Error(`Cannot start task ${this.id}: current status is ${this._status}`);
    }
    
    this._status = 'in_progress';
    this._startedAt = new Date();
    this._error = null; // Clear any previous error
  }

  /**
   * Mark task as completed with result
   */
  complete(result?: any): void {
    if (this._status !== 'in_progress') {
      throw new Error(`Cannot complete task ${this.id}: current status is ${this._status}`);
    }
    
    this._status = 'completed';
    this._result = result || null;
    this._completedAt = new Date();
    this._error = null; // Clear any error on success
  }

  /**
   * Mark task as failed with error
   */
  fail(error: string): void {
    if (this._status === 'completed') {
      throw new Error(`Cannot fail task ${this.id}: task is already completed`);
    }
    
    this._status = 'failed';
    this._error = error;
    this._completedAt = new Date();
  }

  /**
   * Cancel task execution
   */
  cancel(reason?: string): void {
    if (this._status === 'completed' || this._status === 'failed') {
      throw new Error(`Cannot cancel task ${this.id}: task is already ${this._status}`);
    }
    
    this._status = 'cancelled';
    this._error = reason ? `Cancelled: ${reason}` : 'Cancelled by user';
    this._completedAt = new Date();
  }

  /**
   * Mark task as timed out
   */
  timeout(): void {
    if (this._status === 'completed' || this._status === 'failed') {
      throw new Error(`Cannot timeout task ${this.id}: task is already ${this._status}`);
    }
    
    this._status = 'timeout';
    this._error = 'Task execution timed out';
    this._completedAt = new Date();
  }

  /**
   * Update task result during execution (for progress tracking)
   */
  updateResult(result: any): void {
    if (this._status !== 'in_progress') {
      throw new Error(`Cannot update result for task ${this.id}: task is not in progress`);
    }
    
    this._result = result;
  }

  /**
   * Check if task is in a terminal state
   */
  get isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled', 'timeout'].includes(this._status);
  }

  /**
   * Check if task is running
   */
  get isRunning(): boolean {
    return this._status === 'in_progress';
  }

  /**
   * Check if task is pending
   */
  get isPending(): boolean {
    return this._status === 'pending';
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