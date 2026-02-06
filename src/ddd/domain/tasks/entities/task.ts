/**
 * Task Domain Entity
 * 
 * Represents an agent execution task with its lifecycle and state.
 * Tasks are created when agents are executed and track progress/results.
 * 
 * AIDEV-NOTE: Domain entity for task management - contains business logic
 * for task lifecycle and status transitions with DDD Value Objects
 */

import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { TaskId } from '../value-objects/task-id';
import { TaskStatus, TASK_STATUS } from '../value-objects/task-status';
import {
  AgentId,
  OrganizationId,
  UserId
} from '@/ddd/domain/shared/value-objects';
import type { TableChangeEvent } from '@/ddd/domain/scheduling/types/scheduling-types';

// Re-export TaskStatus for external use
export { TaskStatus };

/**
 * Trigger context provides information about what triggered this task
 *
 * AIDEV-NOTE: For DATABASE_EVENT triggers, agents can access row data in two ways:
 * 1. Direct access: triggerContext.tableChange.rowData (plain object)
 * 2. Type-safe entity: Row.fromPlainObject(rowData, tableId, tableFields)
 *
 * Example:
 * ```typescript
 * if (task.triggerContext?.type === 'DATABASE_EVENT') {
 *   const { tableId, rowData } = task.triggerContext.tableChange;
 *   const table = await tableService.getTable(tableId);
 *   const row = Row.fromPlainObject(rowData, tableId, table.fields);
 *   // Now use row.getFieldValue(), row.toPlainObject(), etc.
 * }
 * ```
 */
export interface TriggerContext {
  type: 'DATABASE_EVENT' | 'CALENDAR' | 'WEBHOOK' | 'MANUAL';
  scheduleName?: string; // Name of the schedule that triggered this task
  tableChange?: TableChangeEvent; // For DATABASE_EVENT triggers
  calendarData?: {  // For CALENDAR triggers
    scheduledTime: string; // ISO timestamp of scheduled execution
    timezone: string; // Timezone of the schedule
  };
}

/**
 * Image attachment for task instructions
 *
 * AIDEV-NOTE: Images are downloaded from S3 URLs at execution time
 * and passed to smolagents agent.run(images=[PIL.Image, ...])
 */
export interface ImageAttachment {
  url: string;      // S3 pre-signed URL
  s3Key?: string;   // S3 key for reference
}

/**
 * File attachment metadata for task instructions
 *
 * AIDEV-NOTE: Non-image files (PDFs, audio, documents) are preprocessed
 * to text and included in the 'task' field. This interface preserves
 * metadata for audit/tracking purposes.
 */
export interface FileAttachment {
  type: 'pdf' | 'audio' | 'document' | 'text';
  url: string;
  filename: string;
  mimeType: string;
  preprocessed: true;  // Flag indicating text already extracted and in 'task'
}

/**
 * Task instruction configuration
 *
 * AIDEV-NOTE: This structure directly maps to smolagents agent.run() parameters:
 * - task: Main instruction text → agent.run(task=...)
 * - images: Image URLs → downloaded → agent.run(images=[PIL.Image, ...])
 * - attachments: File metadata (preprocessed files already in task text)
 * - tools: Available tools for agent
 * - metadata: Additional context
 */
export interface TaskInstructions {
  task: string;                     // Primary instruction text (required)
  images?: ImageAttachment[];       // Image attachments (optional)
  attachments?: FileAttachment[];   // Non-image files (optional, for metadata)
  tools?: ToolConfig[];
  metadata?: Record<string, any>;
}

export interface TaskConfig {
  id?: TaskId; // Will be generated if not provided
  agentId?: AgentId | null; // null = org-level task, set = agent executes this
  organizationId: OrganizationId;
  name: string;
  instructions: TaskInstructions;
  skillId?: number; // Optional - execute this skill instead of raw instructions
  triggerContext?: TriggerContext; // Optional - what triggered this task
  status?: TaskStatus;
  result?: any;
  error?: string;
  logs?: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdBy?: UserId;
  createdAt?: Date;
}

export interface CreateTaskData {
  agentId?: AgentId | null; // null = org-level task
  name: string;
  instructions: TaskInstructions; // Task configuration
  skillId?: number; // Optional - execute this skill instead of raw instructions
  triggerContext?: TriggerContext; // What triggered this task
  createdBy?: UserId;
}

export class Task {
  private constructor(
    public readonly id: TaskId,
    public readonly agentId: AgentId | null, // null = org-level task
    public readonly organizationId: OrganizationId,
    public readonly name: string,
    public readonly instructions: TaskInstructions,
    public readonly skillId: number | null, // Optional skill to execute
    public readonly triggerContext: TriggerContext | null,
    private _status: TaskStatus,
    private _result: any | null,
    private _error: string | null,
    private _logs: string[],
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

    // AIDEV-NOTE: agentId is now optional - null = org-level task
    // No validation needed - null is a valid value

    return new Task(
      config.id || TaskId.generate(),
      config.agentId || null, // null for org-level tasks
      config.organizationId,
      config.name,
      config.instructions,
      config.skillId || null,
      config.triggerContext || null,
      config.status || TaskStatus.pending(),
      config.result || null,
      config.error || null,
      config.logs || [],
      config.startedAt || null,
      config.completedAt || null,
      config.createdBy || null,
      config.createdAt || now
    );
  }

  static fromPersistence(data: {
    id: string;
    agentId: number | null; // null = org-level task
    organizationId: number;
    name: string;
    instructions: any; // JSONB from database
    skillId?: number | null; // Optional skill reference
    triggerContext?: any; // JSONB from database
    status: string;
    result?: any;
    error?: string | null;
    logs?: any; // JSONB from database
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdBy?: string | null;
    createdAt: Date;
  }): Task {
    return new Task(
      TaskId.fromString(data.id),
      data.agentId !== null ? AgentId.fromNumber(data.agentId) : null, // Handle nullable agentId
      OrganizationId.fromNumber(data.organizationId),
      data.name,
      data.instructions as TaskInstructions,
      data.skillId || null,
      data.triggerContext as TriggerContext | null || null,
      TaskStatus.fromString(data.status),
      data.result || null,
      data.error || null,
      Array.isArray(data.logs) ? data.logs : [],
      data.startedAt || null,
      data.completedAt || null,
      data.createdBy ? UserId.fromString(data.createdBy) : null,
      data.createdAt
    );
  }

  toPersistence(): {
    id: string;
    agentId: number | null; // null = org-level task
    organizationId: number;
    name: string;
    instructions: any;
    skillId: number | null;
    triggerContext: TriggerContext | null;
    status: string;
    result: any;
    error: string | null;
    logs: string[];
    startedAt: Date | null;
    completedAt: Date | null;
    createdBy: string | null;
    createdAt: Date;
  } {
    return {
      id: this.id.value,
      agentId: this.agentId?.value ?? null, // Handle nullable agentId
      organizationId: this.organizationId.value,
      name: this.name,
      instructions: this.instructions,
      skillId: this.skillId,
      triggerContext: this.triggerContext,
      status: this._status.value,
      result: this._result,
      error: this._error,
      logs: this._logs,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      createdBy: this.createdBy?.value || null,
      createdAt: this.createdAt
    };
  }

  // Getters
  get status(): TaskStatus { return this._status; }
  get result(): any | null { return this._result; }
  get error(): string | null { return this._error; }
  get logs(): string[] { return this._logs; }
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
   * Append a log message to the task
   */
  appendLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    this._logs.push(logEntry);
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
   * Check if task is in a terminal state (not awaiting_human - that's a paused state)
   */
  get isTerminal(): boolean {
    return [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.CANCELLED].includes(this._status.value as any);
  }

  /**
   * Check if task is in an active state (running or awaiting human)
   */
  get isActive(): boolean {
    return this._status.value === TASK_STATUS.IN_PROGRESS ||
           this._status.value === TASK_STATUS.AWAITING_HUMAN;
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
   * Check if task is awaiting human input
   */
  get isAwaitingHuman(): boolean {
    return this._status.value === TASK_STATUS.AWAITING_HUMAN;
  }

  /**
   * Pause task for human input
   */
  awaitHuman(): void {
    if (!this._status.canTransitionTo(TaskStatus.awaitingHuman())) {
      throw new Error(`Cannot await human for task ${this.id}: current status is ${this._status.value}`);
    }

    this._status = TaskStatus.awaitingHuman();
  }

  /**
   * Resume task from human input
   */
  resumeFromHuman(): void {
    if (this._status.value !== TASK_STATUS.AWAITING_HUMAN) {
      throw new Error(`Cannot resume task ${this.id}: task is not awaiting human input`);
    }

    this._status = TaskStatus.inProgress();
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