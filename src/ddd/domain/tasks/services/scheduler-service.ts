/**
 * Scheduler Service
 *
 * Domain service for managing agent task scheduling using agents.automations configuration.
 * Replaces MemoryScheduledJobRepository with proper domain service pattern.
 *
 * AIDEV-NOTE: This service uses the existing agents.automations JSONB field for scheduling.
 * Automations reference skills by ID, so task creation requires skill lookup.
 */

import { Task } from '../entities/task';
import type { AgentId } from '@/ddd/domain/shared/value-objects';
import type { TriggerConfig, TriggerType, ScheduledTask, AutomationTaskRequest } from '@/ddd/domain/scheduling';
import { CalendarTriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import { IAgentRepository } from '../../agents/repositories/agent-repository';

/**
 * Domain service for managing task scheduling
 */
export interface ISchedulerService {
  /**
   * Schedule a recurring task for an agent via automation
   */
  scheduleAutomation(request: AutomationTaskRequest): Promise<void>;

  /**
   * Get tasks due for execution
   * AIDEV-NOTE: In the new model, this returns automations that need to run.
   * The caller must look up the skill by ID to get execution instructions.
   */
  getAutomationsDueForExecution(before?: Date): Promise<{
    agentId: AgentId;
    automationName: string;
    skillId: number;
    trigger: TriggerConfig;
    inputMappings?: Array<{ triggerField: string; skillInputName: string }>;
  }[]>;

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

  async scheduleAutomation(request: AutomationTaskRequest): Promise<void> {
    // Add new automation to agent's automations array
    const agent = await this.agentRepository.findById(request.agentId);
    if (agent) {
      // Add the new automation configuration to existing automations
      const updatedAutomations = [...agent.automations, request.automation];
      await this.agentRepository.update(request.agentId, {
        automations: updatedAutomations
      });
    }
  }

  async getAutomationsDueForExecution(before: Date = new Date()): Promise<{
    agentId: AgentId;
    automationName: string;
    skillId: number;
    trigger: TriggerConfig;
    inputMappings?: Array<{ triggerField: string; skillInputName: string }>;
  }[]> {
    const dueAutomations: {
      agentId: AgentId;
      automationName: string;
      skillId: number;
      trigger: TriggerConfig;
      inputMappings?: Array<{ triggerField: string; skillInputName: string }>;
    }[] = [];

    // Get all agents
    const agents = await this.agentRepository.findAll();

    for (const agent of agents) {
      // Iterate through each agent's automations
      for (const automation of agent.automations) {
        // Only process enabled calendar triggers
        if (!automation.enabled || automation.trigger.type !== 'CALENDAR') {
          continue;
        }

        // Check if automation is due for execution
        const nextRun = this.calculateNextExecution(automation.trigger);
        if (!nextRun || nextRun > before) {
          continue;
        }

        dueAutomations.push({
          agentId: agent.id,
          automationName: automation.name || `Automation ${automation.skillId}`,
          skillId: automation.skillId,
          trigger: automation.trigger,
          inputMappings: automation.inputMappings
        });
      }
    }

    return dueAutomations;
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
      // Skip automation with invalid RRule instead of silently executing on fallback schedule
      console.error('[SCHEDULER] Invalid RRule for trigger, skipping automation:', error);
      return null;
    }
  }
}
