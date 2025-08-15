/**
 * Calendar Dispatcher - Handles scheduled task execution based on calendar events
 * Uses RRule for complex scheduling patterns and smart polling
 */

import { RRule } from 'rrule';
import { db } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { taskExecutionPipeline, type TaskCreationRequest } from '../task-execution-pipeline';
import type { TriggerConfig } from '@/app/actions/types';

export interface CalendarConfig {
  rrule?: string; // RRule string for complex scheduling
  timezone?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduledAgent {
  agent: any;
  config: CalendarConfig;
  nextExecution?: Date;
  rruleInstance?: RRule;
}

export class CalendarDispatcher {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private scheduledAgents = new Map<number, ScheduledAgent>();
  private readonly CHECK_INTERVAL = 60000; // Check every minute

  /**
   * Start the calendar dispatcher
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[CALENDAR-DISPATCHER] Already running');
      return;
    }

    try {
      console.log('[CALENDAR-DISPATCHER] 📅 Starting calendar dispatcher...');
      
      // Load agents with calendar triggers
      await this.loadCalendarAgents();
      
      // Start periodic check for due executions
      this.startPeriodicCheck();
      
      this.isRunning = true;
      console.log(`[CALENDAR-DISPATCHER] ✅ Calendar dispatcher started (${this.scheduledAgents.size} scheduled agents)`);
      
    } catch (error) {
      console.error('[CALENDAR-DISPATCHER] ❌ Failed to start calendar dispatcher:', error);
    }
  }

  /**
   * Stop the calendar dispatcher
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
      
      this.scheduledAgents.clear();
      this.isRunning = false;
      console.log('[CALENDAR-DISPATCHER] 🛑 Calendar dispatcher stopped');
    } catch (error) {
      console.error('[CALENDAR-DISPATCHER] ❌ Error stopping calendar dispatcher:', error);
    }
  }

  /**
   * Load agents that have CALENDAR triggers
   */
  private async loadCalendarAgents(): Promise<void> {
    try {
      const agentsWithCalendarTriggers = await db
        .select()
        .from(agents)
        .where(eq(agents.status, 'active'));

      this.scheduledAgents.clear();

      for (const agent of agentsWithCalendarTriggers) {
        const triggerConfig = agent.trigger as TriggerConfig;
        
        if (triggerConfig?.type === 'CALENDAR') {
          const config: CalendarConfig = {
            rrule: (triggerConfig as any).rrule, // TODO: Add rrule to TriggerConfig type
            timezone: (triggerConfig as any).timezone || 'UTC',
            startDate: (triggerConfig as any).startDate ? new Date((triggerConfig as any).startDate) : new Date(),
            endDate: (triggerConfig as any).endDate ? new Date((triggerConfig as any).endDate) : undefined
          };
          
          const scheduledAgent = await this.createScheduledAgent(agent, config);
          if (scheduledAgent) {
            this.scheduledAgents.set(agent.id, scheduledAgent);
            console.log(`[CALENDAR-DISPATCHER] 📋 Loaded agent ${agent.id} (${agent.name}) - Next: ${scheduledAgent.nextExecution?.toISOString()}`);
          }
        }
      }
    } catch (error) {
      console.error('[CALENDAR-DISPATCHER] ❌ Error loading calendar agents:', error);
    }
  }

  /**
   * Create a scheduled agent with RRule processing
   */
  private async createScheduledAgent(agent: any, config: CalendarConfig): Promise<ScheduledAgent | null> {
    try {
      if (!config.rrule) {
        console.warn(`[CALENDAR-DISPATCHER] ⚠️ Agent ${agent.id} has no RRule configuration`);
        return null;
      }

      // Parse RRule
      const rruleInstance = RRule.fromString(config.rrule);
      
      // Calculate next execution time
      const now = new Date();
      const nextExecution = rruleInstance.after(now, true); // true = inclusive

      if (!nextExecution) {
        console.warn(`[CALENDAR-DISPATCHER] ⚠️ Agent ${agent.id} has no future executions`);
        return null;
      }

      return {
        agent,
        config,
        nextExecution,
        rruleInstance
      };
    } catch (error) {
      console.error(`[CALENDAR-DISPATCHER] ❌ Error creating scheduled agent ${agent.id}:`, error);
      return null;
    }
  }

  /**
   * Start periodic check for due calendar executions
   */
  private startPeriodicCheck(): void {
    console.log('[CALENDAR-DISPATCHER] ⏰ Starting periodic calendar check...');
    
    // Check immediately
    this.checkDueExecutions();
    
    // Then check every minute
    this.checkInterval = setInterval(() => {
      this.checkDueExecutions();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Check for calendar events that are due for execution
   */
  private async checkDueExecutions(): Promise<void> {
    const now = new Date();
    const dueAgents: ScheduledAgent[] = [];

    // Find agents that are due for execution
    for (const [agentId, scheduledAgent] of Array.from(this.scheduledAgents)) {
      if (scheduledAgent.nextExecution && scheduledAgent.nextExecution <= now) {
        dueAgents.push(scheduledAgent);
      }
    }

    if (dueAgents.length === 0) {
      return; // No agents due
    }

    console.log(`[CALENDAR-DISPATCHER] ⏰ ${dueAgents.length} agents due for execution`);

    // Execute due agents
    for (const scheduledAgent of dueAgents) {
      try {
        await this.executeCalendarTask(scheduledAgent);
        
        // Calculate next execution time
        await this.updateNextExecution(scheduledAgent);
        
      } catch (error) {
        console.error(`[CALENDAR-DISPATCHER] ❌ Error executing calendar task for agent ${scheduledAgent.agent.id}:`, error);
      }
    }
  }

  /**
   * Execute a calendar-triggered task
   */
  private async executeCalendarTask(scheduledAgent: ScheduledAgent): Promise<void> {
    const { agent, config } = scheduledAgent;
    
    console.log(`[CALENDAR-DISPATCHER] 📅 Executing calendar task for agent ${agent.id} (${agent.name})`);
    
    const instructions = `Scheduled execution triggered by calendar event. Execute according to your scheduled configuration.`;
    
    const taskRequest: TaskCreationRequest = {
      agentId: agent.id,
      instructions,
      triggerType: 'CALENDAR',
      metadata: {
        scheduledTime: scheduledAgent.nextExecution?.toISOString(),
        timezone: config.timezone,
        rrule: config.rrule,
        executedAt: new Date().toISOString()
      }
    };

    try {
      const result = await taskExecutionPipeline.createAndExecuteTask(taskRequest);
      
      if (result.success) {
        console.log(`[CALENDAR-DISPATCHER] ✅ Calendar task ${result.taskId.substring(0, 8)} completed for agent ${agent.id}`);
      } else {
        console.log(`[CALENDAR-DISPATCHER] ❌ Calendar task ${result.taskId.substring(0, 8)} failed for agent ${agent.id}: ${result.error}`);
      }
    } catch (error) {
      console.error(`[CALENDAR-DISPATCHER] ❌ Error executing calendar task for agent ${agent.id}:`, error);
    }
  }

  /**
   * Update next execution time for a scheduled agent
   */
  private async updateNextExecution(scheduledAgent: ScheduledAgent): Promise<void> {
    try {
      if (!scheduledAgent.rruleInstance) return;

      const now = new Date();
      const nextExecution = scheduledAgent.rruleInstance.after(now, false); // false = exclusive

      if (nextExecution) {
        scheduledAgent.nextExecution = nextExecution;
        console.log(`[CALENDAR-DISPATCHER] 📅 Next execution for agent ${scheduledAgent.agent.id}: ${nextExecution.toISOString()}`);
      } else {
        // No more executions, remove from scheduled agents
        console.log(`[CALENDAR-DISPATCHER] 🏁 No more executions for agent ${scheduledAgent.agent.id}, removing from schedule`);
        this.scheduledAgents.delete(scheduledAgent.agent.id);
      }
    } catch (error) {
      console.error(`[CALENDAR-DISPATCHER] ❌ Error updating next execution for agent ${scheduledAgent.agent.id}:`, error);
    }
  }

  /**
   * Reload agents (called when agent configurations change)
   */
  async reloadAgents(): Promise<void> {
    console.log('[CALENDAR-DISPATCHER] 🔄 Reloading calendar agents...');
    await this.loadCalendarAgents();
  }

  /**
   * Get status of all scheduled agents
   */
  getScheduledAgentsStatus(): Array<{agentId: number, name: string, nextExecution: string | null}> {
    return Array.from(this.scheduledAgents.values()).map(scheduledAgent => ({
      agentId: scheduledAgent.agent.id,
      name: scheduledAgent.agent.name,
      nextExecution: scheduledAgent.nextExecution?.toISOString() || null
    }));
  }
}

// Global calendar dispatcher instance
export const calendarDispatcher = new CalendarDispatcher();