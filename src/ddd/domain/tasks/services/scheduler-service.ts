/**
 * Scheduler Service
 * 
 * Domain service for managing agent task scheduling using agents.trigger configuration.
 * Replaces MemoryScheduledJobRepository with proper domain service pattern.
 * 
 * AIDEV-NOTE: This service uses the existing agents.trigger JSONB field for scheduling
 * instead of creating duplicate ScheduledJob entities.
 */

import { Task } from '../entities/task';
import type { AgentId } from '@/ddd/domain/shared/value-objects';
import type { TriggerConfig, TriggerType, ScheduledTask, ScheduleTaskRequest } from '@/ddd/domain/scheduling';
import { CalendarTriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { IAgentRepository } from '../../agents/repositories/agent-repository';

/**
 * Domain service for managing task scheduling
 */
export interface ISchedulerService {
  /**
   * Schedule a recurring task for an agent
   */
  scheduleTask(request: ScheduleTaskRequest): Promise<void>;

  /**
   * Get tasks due for execution
   */
  getTasksDueForExecution(before?: Date): Promise<Task[]>;

  /**
   * Get active scheduled tasks for an agent
   */
  getScheduledTasksForAgent(agentId: AgentId): Promise<ScheduledTask[]>;

  /**
   * Update next execution time after task completion
   */
  updateNextExecution(agentId: AgentId, success: boolean): Promise<void>;

  /**
   * Activate/deactivate scheduled tasks for an agent
   */
  setAgentScheduleActive(agentId: AgentId, active: boolean): Promise<void>;

  /**
   * Get scheduler statistics
   */
  getSchedulerStats(): Promise<{
    totalScheduledTasks: number;
    activeTasks: number;
    tasksByTriggerType: Record<TriggerType, number>;
    averageSuccessRate: number;
  }>;

  /**
   * Calculate next execution time based on trigger config
   */
  calculateNextExecution(trigger: TriggerConfig, lastExecution?: Date): Date | null;
}

export class SchedulerService implements ISchedulerService {
  constructor(
    private agentRepository: IAgentRepository // Will be injected from container
  ) {}

  async scheduleTask(request: ScheduleTaskRequest): Promise<void> {
    // Update agent's trigger configuration
    // This will be handled by the agent repository in the infrastructure layer
    const agent = await this.agentRepository.findById(request.agentId);
    if (agent) {
      await this.agentRepository.update(request.agentId, {
        trigger: request.trigger
      });
    }
  }

  async getTasksDueForExecution(before: Date = new Date()): Promise<Task[]> {
    // AIDEV-NOTE: Temporarily return empty until repository methods are implemented
    return [];
  }

  async getScheduledTasksForAgent(agentId: AgentId): Promise<ScheduledTask[]> {
    // AIDEV-NOTE: Temporarily return empty until agent entity has all required properties
    return [];
  }

  async updateNextExecution(agentId: AgentId, success: boolean): Promise<void> {
    // AIDEV-NOTE: Temporarily disabled until agent entity has execution tracking
    return;
  }

  async setAgentScheduleActive(agentId: AgentId, active: boolean): Promise<void> {
    // AIDEV-NOTE: Temporarily disabled until agent entity has setActive method
    return;
  }

  async getSchedulerStats(): Promise<{
    totalScheduledTasks: number;
    activeTasks: number;
    tasksByTriggerType: Record<TriggerType, number>;
    averageSuccessRate: number;
  }> {
    // AIDEV-NOTE: Temporarily return empty stats until repository methods are implemented
    return {
      totalScheduledTasks: 0,
      activeTasks: 0,
      tasksByTriggerType: {} as Record<TriggerType, number>,
      averageSuccessRate: 0
    };
  }

  calculateNextExecution(trigger: TriggerConfig, lastExecution?: Date): Date | null {
    if (!(trigger instanceof CalendarTriggerConfig)) {
      return null;
    }

    // Use the proper RRule library through the Value Object
    const baseTime = lastExecution || new Date();
    
    try {
      // Use the CalendarTriggerConfig's built-in RRule processing
      const nextOccurrence = trigger.getNextOccurrence(baseTime);
      
      if (nextOccurrence) {
        // Ensure the next occurrence respects the trigger's start/end dates
        if (trigger.endDate && nextOccurrence > trigger.endDate) {
          return null; // Schedule has ended
        }
        
        if (nextOccurrence < trigger.startDate) {
          // If next occurrence is before start date, get first occurrence after start date
          return trigger.getNextOccurrence(trigger.startDate);
        }
        
        return nextOccurrence;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to calculate next execution for trigger:', error);
      
      // Fallback: execute in 1 hour if RRule parsing fails
      const nextTime = new Date(baseTime);
      nextTime.setHours(nextTime.getHours() + 1);
      nextTime.setMinutes(0);
      nextTime.setSeconds(0);
      nextTime.setMilliseconds(0);
      return nextTime;
    }
  }
}