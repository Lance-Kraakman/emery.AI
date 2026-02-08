// AIDEV-NOTE: TaskStatus Value Object - type-safe task lifecycle management
// Encapsulates task state transitions and business rules

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  AWAITING_HUMAN: 'awaiting_human',  // Paused, waiting for human to complete a step
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type TaskStatusType = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export class TaskStatus {
  private readonly _value: TaskStatusType;

  constructor(value: string) {
    if (!value) {
      throw new Error('Task status cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error(`Invalid task status: ${value}. Must be one of: ${Object.values(TASK_STATUS).join(', ')}`);
    }
    
    this._value = value as TaskStatusType;
  }

  get value(): string {
    return this._value;
  }

  private isValid(status: string): status is TaskStatusType {
    return Object.values(TASK_STATUS).includes(status as TaskStatusType);
  }

  static fromString(value: string): TaskStatus {
    return new TaskStatus(value);
  }

  static pending(): TaskStatus {
    return new TaskStatus(TASK_STATUS.PENDING);
  }

  static inProgress(): TaskStatus {
    return new TaskStatus(TASK_STATUS.IN_PROGRESS);
  }

  static awaitingHuman(): TaskStatus {
    return new TaskStatus(TASK_STATUS.AWAITING_HUMAN);
  }

  static completed(): TaskStatus {
    return new TaskStatus(TASK_STATUS.COMPLETED);
  }

  static failed(): TaskStatus {
    return new TaskStatus(TASK_STATUS.FAILED);
  }

  static cancelled(): TaskStatus {
    return new TaskStatus(TASK_STATUS.CANCELLED);
  }

  static isValidStatus(value: string): boolean {
    try {
      new TaskStatus(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if task is currently running (actively executing)
   */
  isRunning(): boolean {
    return this._value === TASK_STATUS.IN_PROGRESS;
  }

  /**
   * Check if task is awaiting human input
   */
  isAwaitingHuman(): boolean {
    return this._value === TASK_STATUS.AWAITING_HUMAN;
  }

  /**
   * Check if task is in an active state (running or waiting for human)
   */
  isActive(): boolean {
    return this._value === TASK_STATUS.IN_PROGRESS ||
           this._value === TASK_STATUS.AWAITING_HUMAN;
  }

  /**
   * Check if task is in a final state
   */
  isFinal(): boolean {
    return this._value === TASK_STATUS.COMPLETED || 
           this._value === TASK_STATUS.FAILED || 
           this._value === TASK_STATUS.CANCELLED;
  }

  /**
   * Check if task can be started
   */
  canStart(): boolean {
    return this._value === TASK_STATUS.PENDING;
  }

  /**
   * Check if task can be cancelled
   */
  canCancel(): boolean {
    return this._value === TASK_STATUS.PENDING ||
           this._value === TASK_STATUS.IN_PROGRESS ||
           this._value === TASK_STATUS.AWAITING_HUMAN;
  }

  /**
   * Check if task can be retried
   */
  canRetry(): boolean {
    return this._value === TASK_STATUS.FAILED;
  }

  /**
   * Get next logical status transitions
   */
  getPossibleTransitions(): TaskStatus[] {
    switch (this._value) {
      case TASK_STATUS.PENDING:
        return [TaskStatus.inProgress(), TaskStatus.cancelled()];
      case TASK_STATUS.IN_PROGRESS:
        return [TaskStatus.completed(), TaskStatus.failed(), TaskStatus.cancelled(), TaskStatus.awaitingHuman()];
      case TASK_STATUS.AWAITING_HUMAN:
        return [TaskStatus.inProgress(), TaskStatus.cancelled(), TaskStatus.failed()]; // Human completes → resume
      case TASK_STATUS.FAILED:
        return [TaskStatus.pending()]; // Can be retried
      case TASK_STATUS.COMPLETED:
      case TASK_STATUS.CANCELLED:
        return []; // Final states
      default:
        return [];
    }
  }

  /**
   * Check if transition to another status is allowed
   */
  canTransitionTo(newStatus: TaskStatus): boolean {
    const possibleTransitions = this.getPossibleTransitions();
    return possibleTransitions.some(status => status.equals(newStatus));
  }

  /**
   * Get priority level for task processing
   */
  getPriorityLevel(): number {
    switch (this._value) {
      case TASK_STATUS.FAILED: return 1; // High priority for retries
      case TASK_STATUS.AWAITING_HUMAN: return 2; // Needs human attention
      case TASK_STATUS.PENDING: return 3; // Normal priority
      case TASK_STATUS.IN_PROGRESS: return 4; // Currently running
      case TASK_STATUS.COMPLETED: return 5; // Lowest priority
      case TASK_STATUS.CANCELLED: return 6; // No priority
      default: return 7;
    }
  }

  equals(other: TaskStatus): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Get display name for UI
   */
  getDisplayName(): string {
    switch (this._value) {
      case TASK_STATUS.PENDING: return 'Pending';
      case TASK_STATUS.IN_PROGRESS: return 'In Progress';
      case TASK_STATUS.AWAITING_HUMAN: return 'Awaiting Human';
      case TASK_STATUS.COMPLETED: return 'Completed';
      case TASK_STATUS.FAILED: return 'Failed';
      case TASK_STATUS.CANCELLED: return 'Cancelled';
      default: return this._value;
    }
  }

  /**
   * Get CSS class for status display
   */
  getCssClass(): string {
    switch (this._value) {
      case TASK_STATUS.PENDING: return 'status-pending';
      case TASK_STATUS.IN_PROGRESS: return 'status-in-progress';
      case TASK_STATUS.AWAITING_HUMAN: return 'status-awaiting-human';
      case TASK_STATUS.COMPLETED: return 'status-completed';
      case TASK_STATUS.FAILED: return 'status-failed';
      case TASK_STATUS.CANCELLED: return 'status-cancelled';
      default: return 'status-unknown';
    }
  }

  /**
   * Get progress percentage (0-100)
   */
  getProgressPercentage(): number {
    switch (this._value) {
      case TASK_STATUS.PENDING: return 0;
      case TASK_STATUS.IN_PROGRESS: return 50;
      case TASK_STATUS.AWAITING_HUMAN: return 50; // Paused mid-execution
      case TASK_STATUS.COMPLETED: return 100;
      case TASK_STATUS.FAILED: return 0;
      case TASK_STATUS.CANCELLED: return 0;
      default: return 0;
    }
  }
}