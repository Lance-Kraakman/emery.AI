/**
 * Dispatch Event Entity
 * 
 * Represents an event that triggers agent execution through the scheduling system
 */

import type { TriggerType } from '../value-objects/trigger-config';

export type DispatchEventStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DispatchEventData {
  id: string;
  agentId: number;
  scheduledJobId?: string;              // Optional link to scheduled job
  triggerType: TriggerType;
  triggerPayload: Record<string, any>;  // Trigger-specific data
  status: DispatchEventStatus;
  priority: number;                     // Higher number = higher priority  
  scheduledFor?: Date;                  // When to execute (for delayed execution)
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export class DispatchEvent {
  constructor(private data: DispatchEventData) {}

  // Getters
  get id(): string { return this.data.id; }
  get agentId(): number { return this.data.agentId; }
  get scheduledJobId(): string | undefined { return this.data.scheduledJobId; }
  get triggerType(): TriggerType { return this.data.triggerType; }
  get triggerPayload(): Record<string, any> { return this.data.triggerPayload; }
  get status(): DispatchEventStatus { return this.data.status; }
  get priority(): number { return this.data.priority; }
  get scheduledFor(): Date | undefined { return this.data.scheduledFor; }
  get startedAt(): Date | undefined { return this.data.startedAt; }
  get completedAt(): Date | undefined { return this.data.completedAt; }
  get error(): string | undefined { return this.data.error; }
  get retryCount(): number { return this.data.retryCount; }
  get maxRetries(): number { return this.data.maxRetries; }
  get createdAt(): Date { return this.data.createdAt; }
  get updatedAt(): Date { return this.data.updatedAt; }

  // Business logic methods

  /**
   * Check if this event is ready for execution
   */
  isReadyForExecution(now: Date = new Date()): boolean {
    if (this.status !== 'pending') return false;
    if (this.scheduledFor && this.scheduledFor > now) return false;
    return true;
  }

  /**
   * Check if this event can be retried
   */
  canRetry(): boolean {
    return this.status === 'failed' && this.retryCount < this.maxRetries;
  }

  /**
   * Mark this event as processing
   */
  startProcessing(): DispatchEvent {
    if (this.status !== 'pending') {
      throw new Error(`Cannot start processing event with status: ${this.status}`);
    }

    return new DispatchEvent({
      ...this.data,
      status: 'processing',
      startedAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Mark this event as completed successfully
   */
  markCompleted(): DispatchEvent {
    if (this.status !== 'processing') {
      throw new Error(`Cannot complete event with status: ${this.status}`);
    }

    return new DispatchEvent({
      ...this.data,
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      error: undefined // Clear any previous error
    });
  }

  /**
   * Mark this event as failed
   */
  markFailed(error: string): DispatchEvent {
    if (this.status !== 'processing') {
      throw new Error(`Cannot fail event with status: ${this.status}`);
    }

    return new DispatchEvent({
      ...this.data,
      status: 'failed',
      completedAt: new Date(),
      updatedAt: new Date(),
      error
    });
  }

  /**
   * Retry this failed event
   */
  retry(delayMs?: number): DispatchEvent {
    if (!this.canRetry()) {
      throw new Error(`Cannot retry event: retryCount=${this.retryCount}, maxRetries=${this.maxRetries}, status=${this.status}`);
    }

    const now = new Date();
    const scheduledFor = delayMs ? new Date(now.getTime() + delayMs) : undefined;

    return new DispatchEvent({
      ...this.data,
      status: 'pending',
      retryCount: this.data.retryCount + 1,
      scheduledFor,
      startedAt: undefined,
      completedAt: undefined,
      error: undefined,
      updatedAt: now
    });
  }

  /**
   * Get the execution duration in milliseconds
   */
  getExecutionDuration(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  /**
   * Check if this event has timed out during processing
   */
  hasTimedOut(timeoutMs: number, now: Date = new Date()): boolean {
    if (this.status !== 'processing' || !this.startedAt) return false;
    return (now.getTime() - this.startedAt.getTime()) > timeoutMs;
  }

  // Static factory methods

  /**
   * Create a new dispatch event
   */
  static create(data: {
    agentId: number;
    scheduledJobId?: string;
    triggerType: TriggerType;
    triggerPayload: Record<string, any>;
    priority?: number;
    scheduledFor?: Date;
    maxRetries?: number;
  }): DispatchEvent {
    const now = new Date();
    
    return new DispatchEvent({
      id: crypto.randomUUID(),
      agentId: data.agentId,
      scheduledJobId: data.scheduledJobId,
      triggerType: data.triggerType,
      triggerPayload: data.triggerPayload,
      status: 'pending',
      priority: data.priority || 0,
      scheduledFor: data.scheduledFor,
      retryCount: 0,
      maxRetries: data.maxRetries || 3,
      createdAt: now,
      updatedAt: now
    });
  }

  /**
   * Create an immediate execution event
   */
  static createImmediate(
    agentId: number,
    triggerType: TriggerType,
    triggerPayload: Record<string, any>,
    options?: {
      scheduledJobId?: string;
      priority?: number;
      maxRetries?: number;
    }
  ): DispatchEvent {
    return DispatchEvent.create({
      agentId,
      triggerType,
      triggerPayload,
      scheduledJobId: options?.scheduledJobId,
      priority: options?.priority,
      maxRetries: options?.maxRetries
    });
  }

  /**
   * Create a delayed execution event
   */
  static createDelayed(
    agentId: number,
    triggerType: TriggerType,
    triggerPayload: Record<string, any>,
    delayMs: number,
    options?: {
      scheduledJobId?: string;
      priority?: number;
      maxRetries?: number;
    }
  ): DispatchEvent {
    const scheduledFor = new Date(Date.now() + delayMs);
    
    return DispatchEvent.create({
      agentId,
      triggerType,
      triggerPayload,
      scheduledFor,
      scheduledJobId: options?.scheduledJobId,
      priority: options?.priority,
      maxRetries: options?.maxRetries
    });
  }

  /**
   * Reconstitute from stored data
   */
  static fromData(data: DispatchEventData): DispatchEvent {
    return new DispatchEvent(data);
  }

  /**
   * Convert to plain object for serialization
   */
  toData(): DispatchEventData {
    return { ...this.data };
  }
}