/**
 * Consolidated Agent Scheduler for automatic task execution
 * Handles CRON, DATABASE_EVENT, and WEBHOOK triggers
 * 
 * AIDEV-NOTE: Refactored for better separation of concerns and error handling
 */

import cron from 'node-cron';
import { RRule } from 'rrule';
import { db } from '@/lib/db/client';
import { agents, tasks } from '@/lib/db/schema';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { executeAgentCapabilityViaGRPC } from '@/lib/agents/grpc-executor';
import { v4 as uuidv4 } from 'uuid';

export interface TriggerConfig {
  type: 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT' | 'CALENDAR';
  cron?: string;
  rrule?: string;
  webhook_url?: string;
  webhook_secret?: string;
  table_id?: string;
}

interface SchedulerJob {
  agentId: number;
  agent: any;
  cronJob?: any;
  calendarJob?: NodeJS.Timeout;
  triggerConfig: TriggerConfig;
}

export class AgentScheduler {
  private isRunning = false;
  private scheduledJobs = new Map<number, SchedulerJob>(); // agent_id -> scheduled job
  private checkInterval: NodeJS.Timeout | null = null;
  private postgresListener: any = null;
  
  // AIDEV-NOTE: Consolidated job management with typed interface

  /**
   * Start the background scheduler
   * AIDEV-NOTE: Consolidated initialization with better error recovery
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[SCHEDULER] Already running');
      return;
    }

    console.log('[SCHEDULER] Starting agent scheduler...');
    this.isRunning = true;

    const initTasks = [
      this.initializeScheduledJobs(),
      this.startPeriodicCheck(),
      this.setupDatabaseEventTriggers()
    ];

    try {
      await Promise.allSettled(initTasks);
      console.log('[SCHEDULER] Agent scheduler started successfully');
    } catch (error) {
      console.error('[SCHEDULER] Failed to start agent scheduler:', error);
      // Don't fail completely if some subsystems fail
      console.log('[SCHEDULER] Continuing with partial functionality...');
    }
  }

  /**
   * Stop the background scheduler
   * AIDEV-NOTE: Consolidated cleanup with error handling
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[SCHEDULER] Stopping agent scheduler...');
    this.isRunning = false;

    // Consolidated cleanup tasks
    const cleanupTasks = [
      this.cleanupScheduledJobs(),
      this.stopPeriodicCheck(),
      this.cleanupDatabaseListeners()
    ];

    try {
      await Promise.allSettled(cleanupTasks);
      console.log('[SCHEDULER] Agent scheduler stopped successfully');
    } catch (error) {
      console.error('[SCHEDULER] Error during scheduler cleanup:', error);
    }
  }

  private async cleanupScheduledJobs(): Promise<void> {
    this.scheduledJobs.forEach((schedulerJob, agentId) => {
      if (schedulerJob.cronJob) {
        console.log(`[SCHEDULER] Destroying cron job for agent ${agentId}`);
        schedulerJob.cronJob.destroy();
      }
      if (schedulerJob.calendarJob) {
        console.log(`[SCHEDULER] Clearing calendar job for agent ${agentId}`);
        clearTimeout(schedulerJob.calendarJob);
      }
    });
    this.scheduledJobs.clear();
  }

  private stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async cleanupDatabaseListeners(): Promise<void> {
    if (this.postgresListener) {
      try {
        await this.postgresListener.end();
      } catch (error) {
        console.warn('[SCHEDULER] Error closing database listener:', error);
      }
      this.postgresListener = null;
    }
  }

  /**
   * Initialize scheduled jobs for all agents with triggers
   * AIDEV-NOTE: Consolidated initialization for all trigger types
   */
  private async initializeScheduledJobs(): Promise<void> {
    console.log('[SCHEDULER] Initializing scheduled jobs for existing agents...');
    
    const activeAgents = await this.getActiveAgentsWithTriggers();
    let initialized = 0;

    for (const agent of activeAgents) {
      try {
        const triggerConfig = agent.trigger as TriggerConfig;
        const schedulerJob: SchedulerJob = {
          agentId: agent.id,
          agent,
          triggerConfig
        };

        if (triggerConfig.type === 'CRON' && triggerConfig.cron) {
          schedulerJob.cronJob = await this.createCronJob(agent.id, triggerConfig.cron, agent);
        } else if (triggerConfig.type === 'CALENDAR' && triggerConfig.rrule) {
          schedulerJob.calendarJob = this.createCalendarJob(agent.id, triggerConfig.rrule, agent);
        }

        this.scheduledJobs.set(agent.id, schedulerJob);
        initialized++;
      } catch (error) {
        console.error(`[SCHEDULER] Failed to initialize job for agent ${agent.id}:`, error);
      }
    }

    console.log(`[SCHEDULER] Initialized ${initialized} scheduled jobs`);
  }

  private async getActiveAgentsWithTriggers() {
    return db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.status, 'active'),
          isNotNull(sql`trigger`)
        )
      );
  }

  /**
   * Create a cron job for an agent
   * AIDEV-NOTE: Simplified cron job creation with better error handling
   */
  private async createCronJob(agentId: number, cronExpression: string, agent: any): Promise<any> {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    const job = cron.schedule(
      cronExpression,
      () => this.executeAgentForTrigger(agent, {
        trigger_type: 'CRON',
        scheduled_time: new Date().toISOString(),
        cron_expression: cronExpression,
      }),
      {
        name: `agent_${agentId}_cron`,
        timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
      }
    );

    job.start(); // Start after creation
    console.log(`[SCHEDULER] Created CRON job for agent ${agentId}: ${cronExpression}`);
    return job;
  }

  private createCalendarJob(agentId: number, rruleString: string, agent: any): NodeJS.Timeout | undefined {
    try {
      const rule = RRule.fromString(rruleString);
      const now = new Date();
      const next = rule.after(now);

      if (next) {
        const delay = next.getTime() - now.getTime();
        console.log(`[SCHEDULER] Scheduling calendar job for agent ${agentId} to run at ${next}`);
        return setTimeout(() => {
          this.executeAgentForTrigger(agent, {
            trigger_type: 'CALENDAR',
            scheduled_time: next.toISOString(),
            rrule: rruleString,
          });
          // Reschedule the next job
          this.addSchedulerJob(agent);
        }, delay);
      }
    } catch (error) {
      console.error(`[SCHEDULER] Invalid rrule string for agent ${agentId}:`, error);
    }
  }

  /**
   * Start periodic check for new/updated agents
   * AIDEV-NOTE: Consolidated periodic checking with better error recovery
   */
  private startPeriodicCheck(): void {
    console.log('[SCHEDULER] Starting periodic check for agent updates...');
    
    this.checkInterval = setInterval(() => {
      this.checkForAgentUpdates().catch(error => {
        console.error('[SCHEDULER] Error during periodic check:', error);
      });
    }, 60000); // Check every minute
  }

  /**
   * Check for new or updated agents that need scheduling
   * AIDEV-NOTE: Simplified agent update checking
   */
  private async checkForAgentUpdates(): Promise<void> {
    const currentAgents = await this.getActiveAgentsWithTriggers();
    const currentAgentIds = new Set(currentAgents.map(a => a.id));
    const scheduledAgentIds = new Set(this.scheduledJobs.keys());

    // Add new agents
    for (const agent of currentAgents) {
      if (!scheduledAgentIds.has(agent.id)) {
        await this.addSchedulerJob(agent);
      }
    }

    // Remove inactive agents
    for (const agentId of Array.from(scheduledAgentIds)) {
      if (!currentAgentIds.has(agentId)) {
        this.removeSchedulerJob(agentId);
      }
    }
  }

  private async addSchedulerJob(agent: any): Promise<void> {
    try {
      const triggerConfig = agent.trigger as TriggerConfig;
      const schedulerJob: SchedulerJob = {
        agentId: agent.id,
        agent,
        triggerConfig
      };

      if (triggerConfig.type === 'CRON' && triggerConfig.cron) {
        schedulerJob.cronJob = await this.createCronJob(agent.id, triggerConfig.cron, agent);
      } else if (triggerConfig.type === 'CALENDAR' && triggerConfig.rrule) {
        schedulerJob.calendarJob = this.createCalendarJob(agent.id, triggerConfig.rrule, agent);
      }

      this.scheduledJobs.set(agent.id, schedulerJob);
      console.log(`[SCHEDULER] Added new scheduled job for agent ${agent.id} (${agent.name})`);
    } catch (error) {
      console.error(`[SCHEDULER] Failed to add job for agent ${agent.id}:`, error);
    }
  }

  private removeSchedulerJob(agentId: number): void {
    const job = this.scheduledJobs.get(agentId);
    if (job?.cronJob) {
      job.cronJob.destroy();
    }
    if (job?.calendarJob) {
      clearTimeout(job.calendarJob);
    }
    this.scheduledJobs.delete(agentId);
    console.log(`[SCHEDULER] Removed scheduled job for inactive agent ${agentId}`);
  }

  async updateAgentTrigger(agentId: number, triggerConfig: TriggerConfig): Promise<void> {
    const agent = await db.select().from(agents).where(eq(agents.id, agentId)).then(res => res[0]);
    if (!agent) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }

    await db.update(agents).set({ trigger: triggerConfig }).where(eq(agents.id, agentId));

    this.removeSchedulerJob(agentId);
    await this.addSchedulerJob({ ...agent, trigger: triggerConfig });
  }

  /**
   * Setup database event triggers using PostgreSQL LISTEN/NOTIFY
   */
  private async setupDatabaseEventTriggers(): Promise<void> {
    console.log('[SCHEDULER] Setting up database event triggers...');
    
    try {
      // Import database trigger manager
      const { DatabaseTriggerManager } = await import('./database-triggers');
      
      // Setup triggers for agents with DATABASE_EVENT configuration
      await DatabaseTriggerManager.setupTriggersForAgents();
      
      // Setup PostgreSQL listener
      const { Client } = await import('pg');
      this.postgresListener = new Client({
        connectionString: process.env.DATABASE_URL,
      });

      await this.postgresListener.connect();

      // Listen for table change notifications
      await this.postgresListener.query('LISTEN emery_table_changes');

      this.postgresListener.on('notification', async (msg: any) => {
        try {
          if (msg.channel === 'emery_table_changes') {
            const payload = JSON.parse(msg.payload);
            console.log(`[SCHEDULER-DB] Received table change notification:`, payload);
            await this.handleDatabaseEvent(payload);
          }
        } catch (error) {
          console.error('[SCHEDULER-DB] Error handling database notification:', error);
        }
      });

      console.log('[SCHEDULER] Database event triggers setup complete');
    } catch (error) {
      console.error('[SCHEDULER] Failed to setup database event triggers:', error);
      // Don't throw - continue without database events
    }
  }

  /**
   * Handle database change events
   */
  private async handleDatabaseEvent(payload: any): Promise<void> {
    const { table_id, operation, row_data } = payload;

    // Find agents that have DATABASE_EVENT triggers for this table
    const databaseEventAgents = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.status, 'active'),
          sql`trigger->>'type' = 'DATABASE_EVENT'`,
          sql`trigger->>'table_id' = ${table_id}`
        )
      );

    console.log(`[SCHEDULER-DB] Found ${databaseEventAgents.length} agents for table ${table_id} ${operation}`);

    // Execute each agent
    for (const agent of databaseEventAgents) {
      try {
        console.log(`[SCHEDULER-DB] Executing agent ${agent.id} (${agent.name}) for table event`);
        await this.executeAgentForTrigger(agent, {
          trigger_type: 'DATABASE_EVENT',
          table_id,
          operation,
          row_data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[SCHEDULER-DB] Failed to execute agent ${agent.id} for database event:`, error);
      }
    }
  }

  /**
   * Execute an agent capability for a trigger
   */
  private async executeAgentForTrigger(agent: any, triggerData: Record<string, any>): Promise<void> {
    try {
      // Get the first capability (or could be configurable per trigger)
      const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
      if (capabilities.length === 0) {
        console.warn(`[SCHEDULER] Agent ${agent.id} has no capabilities`);
        return;
      }

      const capability = capabilities[0]; // Execute first capability
      const executionId = uuidv4();

      console.log(`[SCHEDULER] Executing agent ${agent.id} capability '${capability.name}' via ${triggerData.trigger_type} trigger`);

      const result = await executeAgentCapabilityViaGRPC({
        agent,
        capabilityName: capability.name,
        triggerData,
        executionId,
      });

      console.log(`[SCHEDULER] Agent execution completed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (!result.success) {
        console.error(`[SCHEDULER] Agent execution error:`, result.error);
      }

    } catch (error) {
      console.error(`[SCHEDULER] Failed to execute agent ${agent.id}:`, error);

      // Create failed task record
      try {
        await db.insert(tasks).values({
          agentId: agent.id,
          name: `Scheduled execution (${triggerData.trigger_type})`,
          capabilityName: 'unknown',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown scheduler error',
          startedAt: new Date(),
          completedAt: new Date(),
        });
      } catch (dbError) {
        console.error(`[SCHEDULER] Failed to record failed task:`, dbError);
      }
    }
  }

  /**
   * Get scheduler status
   * AIDEV-NOTE: Updated to work with consolidated job structure
   */
  getStatus(): {
    isRunning: boolean;
    totalJobsCount: number;
    cronJobsCount: number;
    activeJobs: Array<{ agentId: number; triggerType: string; cronExpression?: string }>;
  } {
    const activeJobs: Array<{ agentId: number; triggerType: string; cronExpression?: string }> = [];
    let cronJobsCount = 0;
    
    this.scheduledJobs.forEach((schedulerJob, agentId) => {
      const jobInfo = {
        agentId,
        triggerType: schedulerJob.triggerConfig.type,
        cronExpression: schedulerJob.triggerConfig.cron
      };
      
      if (schedulerJob.cronJob) {
        cronJobsCount++;
      }
      
      activeJobs.push(jobInfo);
    });

    return {
      isRunning: this.isRunning,
      totalJobsCount: this.scheduledJobs.size,
      cronJobsCount,
      activeJobs,
    };
  }
}

// Global scheduler instance
export const agentScheduler = new AgentScheduler();

// AIDEV-NOTE: The scheduler automatically handles:
// 1. CRON triggers - time-based scheduling with cron expressions
// 2. DATABASE_EVENT triggers - table change notifications via PostgreSQL LISTEN/NOTIFY
// 3. Dynamic updates - periodically checks for new/updated/deleted agents
// 4. Graceful cleanup - properly destroys cron jobs and database connections
