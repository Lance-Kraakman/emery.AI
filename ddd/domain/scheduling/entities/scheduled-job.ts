/**
 * Scheduled Job Entity
 * 
 * Represents a scheduled execution of an agent with specific timing and trigger configuration
 */

import { RRule } from 'rrule';
import type { TriggerConfig, CalendarTriggerConfig } from '../value-objects/trigger-config';

export interface ScheduledJobData {
  id: string;
  agentId: number;
  name: string;
  description?: string;
  triggerConfig: TriggerConfig;
  isActive: boolean;
  lastExecution?: Date;
  nextExecution?: Date;
  executionCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ScheduledJob {
  constructor(private data: ScheduledJobData) {}

  // Getters
  get id(): string { return this.data.id; }
  get agentId(): number { return this.data.agentId; }
  get name(): string { return this.data.name; }
  get description(): string | undefined { return this.data.description; }
  get triggerConfig(): TriggerConfig { return this.data.triggerConfig; }
  get isActive(): boolean { return this.data.isActive; }
  get lastExecution(): Date | undefined { return this.data.lastExecution; }
  get nextExecution(): Date | undefined { return this.data.nextExecution; }
  get executionCount(): number { return this.data.executionCount; }
  get failureCount(): number { return this.data.failureCount; }
  get createdAt(): Date { return this.data.createdAt; }
  get updatedAt(): Date { return this.data.updatedAt; }

  // Business logic methods

  /**
   * Check if this job is due for execution
   */
  isDue(now: Date = new Date()): boolean {
    if (!this.isActive) return false;
    if (!this.nextExecution) return false;
    return this.nextExecution <= now;
  }

  /**
   * Calculate the next execution time based on the trigger configuration
   */
  calculateNextExecution(): Date | null {
    if (!this.isActive) return null;

    switch (this.triggerConfig.type) {
      case 'CALENDAR': {
        const calendarConfig = this.triggerConfig as CalendarTriggerConfig;
        if (!calendarConfig.rrule) return null;

        try {
          const rule = RRule.fromString(calendarConfig.rrule);
          const now = new Date();
          return rule.after(now, false); // false = exclusive (next occurrence after now)
        } catch (error) {
          console.error(`Invalid RRule for scheduled job ${this.id}:`, error);
          return null;
        }
      }
      
      case 'MANUAL':
      case 'DATABASE_EVENT':
      case 'RAG_REINDEX':
      case 'WEBHOOK':
        // These trigger types don't have predetermined next execution times
        return null;

      default:
        return null;
    }
  }

  /**
   * Mark this job as executed
   */
  recordExecution(success: boolean): ScheduledJob {
    const now = new Date();
    const nextExecution = this.calculateNextExecution() || undefined;

    return new ScheduledJob({
      ...this.data,
      lastExecution: now,
      nextExecution,
      executionCount: this.data.executionCount + 1,
      failureCount: success ? this.data.failureCount : this.data.failureCount + 1,
      updatedAt: now
    });
  }

  /**
   * Activate or deactivate this job
   */
  setActive(isActive: boolean): ScheduledJob {
    const now = new Date();
    const nextExecution = isActive ? (this.calculateNextExecution() || undefined) : undefined;

    return new ScheduledJob({
      ...this.data,
      isActive,
      nextExecution,
      updatedAt: now
    });
  }

  /**
   * Update the trigger configuration and recalculate next execution
   */
  updateTriggerConfig(triggerConfig: TriggerConfig): ScheduledJob {
    const now = new Date();
    const nextExecution = this.isActive ? (this.calculateNextExecutionForConfig(triggerConfig) || undefined) : undefined;

    return new ScheduledJob({
      ...this.data,
      triggerConfig,
      nextExecution,
      updatedAt: now
    });
  }

  private calculateNextExecutionForConfig(config: TriggerConfig): Date | null {
    if (config.type === 'CALENDAR') {
      const calendarConfig = config as CalendarTriggerConfig;
      if (!calendarConfig.rrule) return null;

      try {
        const rule = RRule.fromString(calendarConfig.rrule);
        const now = new Date();
        return rule.after(now, false);
      } catch (error) {
        console.error(`Invalid RRule in new trigger config:`, error);
        return null;
      }
    }

    return null;
  }

  /**
   * Check if this job has exceeded failure thresholds
   */
  hasExceededFailureThreshold(maxFailures: number = 5): boolean {
    return this.failureCount >= maxFailures;
  }

  /**
   * Get execution success rate as a percentage
   */
  getSuccessRate(): number {
    if (this.executionCount === 0) return 0;
    const successCount = this.executionCount - this.failureCount;
    return (successCount / this.executionCount) * 100;
  }

  // Static factory methods

  /**
   * Create a new scheduled job
   */
  static create(data: Omit<ScheduledJobData, 'id' | 'executionCount' | 'failureCount' | 'createdAt' | 'updatedAt' | 'nextExecution'>): ScheduledJob {
    const now = new Date();
    const job = new ScheduledJob({
      ...data,
      id: crypto.randomUUID(),
      executionCount: 0,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
      nextExecution: undefined
    });

    // Calculate initial next execution if active
    const nextExecution = job.isActive ? (job.calculateNextExecution() || undefined) : undefined;
    
    return new ScheduledJob({
      ...job.data,
      nextExecution
    });
  }

  /**
   * Reconstitute from stored data
   */
  static fromData(data: ScheduledJobData): ScheduledJob {
    return new ScheduledJob(data);
  }

  /**
   * Convert to plain object for serialization
   */
  toData(): ScheduledJobData {
    return { ...this.data };
  }
}