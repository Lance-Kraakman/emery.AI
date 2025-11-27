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
    // Add new schedule to agent's schedules array
    const agent = await this.agentRepository.findById(request.agentId);
    if (agent) {
      // Add the new schedule configuration to existing schedules
      const updatedSchedules = [...agent.schedules, request.schedule];
      await this.agentRepository.update(request.agentId, {
        schedules: updatedSchedules
      });
    }
  }

  async getTasksDueForExecution(before: Date = new Date()): Promise<Task[]> {
    const dueTasks: Task[] = [];

    // Get all agents
    const agents = await this.agentRepository.findAll();

    for (const agent of agents) {
      // Iterate through each agent's schedules
      for (const schedule of agent.schedules) {
        // Only process enabled calendar triggers
        if (!schedule.enabled || schedule.trigger.type !== 'CALENDAR') {
          continue;
        }

        // Check if schedule is due for execution
        const nextRun = this.calculateNextExecution(schedule.trigger);
        if (!nextRun || nextRun > before) {
          continue;
        }

        // Create a Task entity for this due schedule
        // Cast trigger to CalendarTriggerConfig to access calendar-specific properties
        const calendarTrigger = schedule.trigger as CalendarTriggerConfig;

        const task = Task.create({
          agentId: agent.id,
          organizationId: agent.organizationId,
          name: schedule.name || `Scheduled: ${schedule.taskInstructions.task.substring(0, 50)}`,
          instructions: {
            ...schedule.taskInstructions,
            metadata: {
              ...schedule.taskInstructions.metadata,
              scheduleType: schedule.trigger.type,
              scheduledFor: nextRun.toISOString(),
              'trigger.scheduledTime': nextRun.toISOString(),
              'trigger.timezone': calendarTrigger.timezone,
              'trigger.scheduleName': schedule.name
            }
          },
          triggerContext: {
            type: 'CALENDAR',
            scheduleName: schedule.name,
            calendarData: {
              scheduledTime: nextRun.toISOString(),
              timezone: calendarTrigger.timezone
            }
          }
        });

        dueTasks.push(task);
      }
    }

    return dueTasks;
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