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

export type TriggerType = 'CRON' | 'DATABASE_EVENT' | 'WEBHOOK' | 'MANUAL';

export interface TriggerConfig {
  type: TriggerType;
  cron?: string; // CRON expression for scheduled tasks
  eventConfig?: {
    table: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    condition?: string;
  };
  webhookConfig?: {
    secret?: string;
    headers?: Record<string, string>;
  };
}

export interface ScheduledTask {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  capabilityName?: string;
  instructions: TaskInstructions;
  trigger: TriggerConfig;
  isActive: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
  executionCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain service for managing task scheduling
 */
export interface ISchedulerService {
  /**
   * Schedule a recurring task for an agent
   */
  scheduleTask(config: {
    agentId: AgentId;
    organizationId: OrganizationId;
    name: string;
    capabilityName?: string;
    instructions: TaskInstructions;
    trigger: TriggerConfig;
  }): Promise<void>;

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

  async scheduleTask(config: {
    agentId: AgentId;
    organizationId: OrganizationId;
    name: string;
    capabilityName?: string;
    instructions: TaskInstructions;
    trigger: TriggerConfig;
  }): Promise<void> {
    // Update agent's trigger configuration
    // This will be handled by the agent repository in the infrastructure layer
    const agent = await this.agentRepository.findById(config.agentId);
    if (agent) {
      agent.updateTrigger(config.trigger);
      await this.agentRepository.save(agent);
    }
  }

  async getTasksDueForExecution(before: Date = new Date()): Promise<Task[]> {
    // Find all active agents with CRON triggers that are due
    const activeAgents = await this.agentRepository.findActiveAgentsWithTriggers();
    const dueTasks: Task[] = [];

    for (const agent of activeAgents) {
      const trigger = agent.trigger;
      if (!trigger || trigger.type !== 'CRON' || !trigger.cron) {
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
              trigger_type: 'CRON',
              scheduled_for: nextExecution.toISOString(),
              cron_expression: trigger.cron
            }
          },
          scheduledFor: nextExecution
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
      nextExecution: this.calculateNextExecution(agent.trigger, agent.lastExecution),
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
    if (trigger.type !== 'CRON' || !trigger.cron) {
      return null;
    }

    // Simple CRON parsing - in real implementation, use a CRON library
    const baseTime = lastExecution || new Date();
    
    // For now, parse simple patterns like "0 */30 * * * *" (every 30 minutes)
    const cronParts = trigger.cron.split(' ');
    if (cronParts.length >= 6) {
      // Basic parsing for minute/hour patterns
      const minutes = cronParts[1];
      
      if (minutes.startsWith('*/')) {
        const interval = parseInt(minutes.substring(2));
        const nextTime = new Date(baseTime);
        nextTime.setMinutes(nextTime.getMinutes() + interval);
        nextTime.setSeconds(0);
        nextTime.setMilliseconds(0);
        return nextTime;
      }
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