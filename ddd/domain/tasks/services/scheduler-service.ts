/**
 * Scheduler Service
 * 
 * Domain service for managing agent task scheduling using agents.trigger configuration.
 * Replaces MemoryScheduledJobRepository with proper domain service pattern.
 * 
 * AIDEV-NOTE: This service uses the existing agents.trigger JSONB field for scheduling
 * instead of creating duplicate ScheduledJob entities.
 */

import { Task, TaskInstructions } from '../entities/task';
import { TaskId } from '../value-objects/task-id';
import { TaskStatus } from '../value-objects/task-status';
import type { AgentId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { TriggerConfig, TriggerType, ScheduledTask, ScheduleTaskRequest } from '@/ddd/domain/scheduling';

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
    private agentRepository: any // Will be injected from container
  ) {}

  async scheduleTask(request: ScheduleTaskRequest): Promise<void> {
    // Update agent's trigger configuration
    // This will be handled by the agent repository in the infrastructure layer
    const agent = await this.agentRepository.findById(request.agentId);
    if (agent) {
      agent.updateTrigger(request.trigger);
      await this.agentRepository.save(agent);
    }
  }

  async getTasksDueForExecution(before: Date = new Date()): Promise<Task[]> {
    // Find all active agents with CALENDAR triggers that are due
    const activeAgents = await this.agentRepository.findActiveAgentsWithTriggers();
    const dueTasks: Task[] = [];

    for (const agent of activeAgents) {
      const trigger = agent.trigger;
      if (!trigger || trigger.type !== 'CALENDAR' || !trigger.rrule) {
        continue;
      }

      const nextExecution = this.calculateNextExecution(trigger, agent.lastExecution);
      if (nextExecution && nextExecution <= before) {
        // Create task for this scheduled execution
        const task = Task.create({
          agentId: agent.id,
          organizationId: agent.organizationId,
          name: `Scheduled: ${agent.name}`,
          capabilityName: agent.capabilityName,
          instructions: {
            instructions: agent.instructions || 'Execute scheduled task',
            tools: agent.tools || [],
            servers: agent.servers || [],
            metadata: {
              trigger_type: 'CALENDAR',
              scheduled_for: nextExecution.toISOString(),
              rrule: trigger.rrule,
              timezone: trigger.timezone || 'UTC'
            }
          }
        });
        
        dueTasks.push(task);
      }
    }

    return dueTasks;
  }

  async getScheduledTasksForAgent(agentId: AgentId): Promise<ScheduledTask[]> {
    const agent = await this.agentRepository.findById(agentId);
    if (!agent || !agent.trigger) {
      return [];
    }

    const scheduledTask: ScheduledTask = {
      agentId: agent.id,
      organizationId: agent.organizationId,
      name: agent.name,
      capabilityName: agent.capabilityName,
      instructions: {
        instructions: agent.instructions || 'Execute scheduled task',
        tools: agent.tools || [],
        servers: agent.servers || []
      },
      trigger: agent.trigger,
      isActive: agent.isActive,
      nextExecution: this.calculateNextExecution(agent.trigger, agent.lastExecution || undefined) || undefined,
      lastExecution: agent.lastExecution,
      executionCount: agent.executionCount || 0,
      failureCount: agent.failureCount || 0,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };

    return [scheduledTask];
  }

  async updateNextExecution(agentId: AgentId, success: boolean): Promise<void> {
    const agent = await this.agentRepository.findById(agentId);
    if (agent) {
      agent.updateExecutionStats(success);
      await this.agentRepository.save(agent);
    }
  }

  async setAgentScheduleActive(agentId: AgentId, active: boolean): Promise<void> {
    const agent = await this.agentRepository.findById(agentId);
    if (agent) {
      agent.setActive(active);
      await this.agentRepository.save(agent);
    }
  }

  async getSchedulerStats(): Promise<{
    totalScheduledTasks: number;
    activeTasks: number;
    tasksByTriggerType: Record<TriggerType, number>;
    averageSuccessRate: number;
  }> {
    const scheduledAgents = await this.agentRepository.findAgentsWithTriggers();
    
    let activeTasks = 0;
    const tasksByTriggerType: Record<string, number> = {};
    let totalExecutions = 0;
    let totalFailures = 0;

    for (const agent of scheduledAgents) {
      if (agent.isActive) {
        activeTasks++;
      }

      const triggerType = agent.trigger?.type || 'MANUAL';
      tasksByTriggerType[triggerType] = (tasksByTriggerType[triggerType] || 0) + 1;

      totalExecutions += agent.executionCount || 0;
      totalFailures += agent.failureCount || 0;
    }

    const averageSuccessRate = totalExecutions > 0
      ? ((totalExecutions - totalFailures) / totalExecutions) * 100
      : 0;

    return {
      totalScheduledTasks: scheduledAgents.length,
      activeTasks,
      tasksByTriggerType: tasksByTriggerType as Record<TriggerType, number>,
      averageSuccessRate: Math.round(averageSuccessRate * 100) / 100
    };
  }

  calculateNextExecution(trigger: TriggerConfig, lastExecution?: Date): Date | null {
    if (trigger.type !== 'CALENDAR' || !trigger.rrule) {
      return null;
    }

    // Basic RRule parsing - in real implementation, use rrule.js library
    const baseTime = lastExecution || new Date();
    
    // For now, parse simple RRule patterns
    // Example: FREQ=HOURLY;INTERVAL=1 (every hour)
    // Example: FREQ=DAILY;BYHOUR=9 (daily at 9 AM)
    try {
      const rrule = trigger.rrule.toUpperCase();
      
      if (rrule.includes('FREQ=HOURLY')) {
        const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
        const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
        
        const nextTime = new Date(baseTime);
        nextTime.setHours(nextTime.getHours() + interval);
        nextTime.setMinutes(0);
        nextTime.setSeconds(0);
        nextTime.setMilliseconds(0);
        return nextTime;
      }
      
      if (rrule.includes('FREQ=DAILY')) {
        const hourMatch = rrule.match(/BYHOUR=(\d+)/);
        const hour = hourMatch ? parseInt(hourMatch[1]) : 9; // Default to 9 AM
        
        const nextTime = new Date(baseTime);
        nextTime.setDate(nextTime.getDate() + 1); // Next day
        nextTime.setHours(hour);
        nextTime.setMinutes(0);
        nextTime.setSeconds(0);
        nextTime.setMilliseconds(0);
        return nextTime;
      }
      
      if (rrule.includes('FREQ=WEEKLY')) {
        const nextTime = new Date(baseTime);
        nextTime.setDate(nextTime.getDate() + 7); // Next week
        nextTime.setHours(9); // Default to 9 AM
        nextTime.setMinutes(0);
        nextTime.setSeconds(0);
        nextTime.setMilliseconds(0);
        return nextTime;
      }
    } catch (error) {
      console.warn('Failed to parse RRule:', trigger.rrule, error);
    }

    // Fallback: execute in 1 hour
    const nextTime = new Date(baseTime);
    nextTime.setHours(nextTime.getHours() + 1);
    nextTime.setMinutes(0);
    nextTime.setSeconds(0);
    nextTime.setMilliseconds(0);
    return nextTime;
  }
}