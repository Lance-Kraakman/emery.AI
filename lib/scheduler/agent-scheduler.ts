/**
 * Background Agent Scheduler for automatic task execution
 * Handles CRON, DATABASE_EVENT, and WEBHOOK triggers
 */

import cron from 'node-cron';
import { db } from '@/lib/db/client';
import { agents, tasks } from '@/lib/db/schema';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { executeAgentCapabilityViaGRPC } from '@/lib/agents/grpc-executor';
import { v4 as uuidv4 } from 'uuid';

export interface TriggerConfig {
  type: 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT';
  cron?: string;
  webhook_url?: string;
  webhook_secret?: string;
  table_id?: string;
}

export class AgentScheduler {
  private isRunning = false;
  private cronJobs = new Map<number, any>(); // agent_id -> cron job
  private checkInterval: NodeJS.Timeout | null = null;
  private postgresListener: any = null;

  /**
   * Start the background scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[SCHEDULER] Already running');
      return;
    }

    console.log('[SCHEDULER] Starting agent scheduler...');
    this.isRunning = true;

    try {
      // Initialize CRON jobs for existing agents
      await this.initializeCronJobs();
      
      // Start checking for new/updated agents
      this.startPeriodicCheck();
      
      // Setup database event triggers
      await this.setupDatabaseEventTriggers();
      
      console.log('[SCHEDULER] Agent scheduler started successfully');
    } catch (error) {
      console.error('[SCHEDULER] Failed to start agent scheduler:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the background scheduler
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[SCHEDULER] Stopping agent scheduler...');
    this.isRunning = false;

    // Clear all cron jobs
    this.cronJobs.forEach((job, agentId) => {
      console.log(`[SCHEDULER] Destroying cron job for agent ${agentId}`);
      job.destroy();
    });
    this.cronJobs.clear();

    // Clear periodic check
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Cleanup database listeners
    if (this.postgresListener) {
      await this.postgresListener.close();
      this.postgresListener = null;
    }

    console.log('[SCHEDULER] Agent scheduler stopped');
  }

  /**
   * Initialize CRON jobs for all agents with CRON triggers
   */
  private async initializeCronJobs(): Promise<void> {
    console.log('[SCHEDULER] Initializing CRON jobs for existing agents...');
    
    const cronAgents = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.status, 'active'),
          sql`trigger->>'type' = 'CRON'`,
          isNotNull(sql`trigger->>'cron'`)
        )
      );

    let initialized = 0;
    for (const agent of cronAgents) {
      try {
        const triggerConfig = agent.trigger as TriggerConfig;
        if (triggerConfig.cron) {
          await this.createCronJob(agent.id, triggerConfig.cron, agent);
          initialized++;
        }
      } catch (error) {
        console.error(`[SCHEDULER] Failed to initialize cron for agent ${agent.id}:`, error);
      }
    }

    console.log(`[SCHEDULER] Initialized ${initialized} CRON jobs`);
  }

  /**
   * Create a cron job for an agent
   */
  private async createCronJob(agentId: number, cronExpression: string, agent: any): Promise<void> {
    try {
      // Validate cron expression using node-cron
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Destroy existing job if any
      const existingJob = this.cronJobs.get(agentId);
      if (existingJob) {
        existingJob.destroy();
      }

      // Create new cron job
      const job = cron.schedule(
        cronExpression,
        async () => {
          console.log(`[SCHEDULER-CRON] Executing agent ${agentId} (${agent.name}) via CRON trigger`);
          await this.executeAgentForTrigger(agent, {
            trigger_type: 'CRON',
            scheduled_time: new Date().toISOString(),
            cron_expression: cronExpression,
          });
        },
        {
          name: `agent_${agentId}_cron`,
          timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
        }
      );

      this.cronJobs.set(agentId, job);
      console.log(`[SCHEDULER] Created CRON job for agent ${agentId}: ${cronExpression}`);
    } catch (error) {
      console.error(`[SCHEDULER] Failed to create CRON job for agent ${agentId}:`, error);
      throw error;
    }
  }

  /**
   * Start periodic check for new/updated agents
   */
  private startPeriodicCheck(): void {
    console.log('[SCHEDULER] Starting periodic check for agent updates...');
    
    this.checkInterval = setInterval(async () => {
      try {
        await this.checkForAgentUpdates();
      } catch (error) {
        console.error('[SCHEDULER] Error during periodic check:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Check for new or updated agents that need scheduling
   */
  private async checkForAgentUpdates(): Promise<void> {
    const cronAgents = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.status, 'active'),
          sql`trigger->>'type' = 'CRON'`,
          isNotNull(sql`trigger->>'cron'`)
        )
      );

    // Check for new agents that don't have cron jobs
    for (const agent of cronAgents) {
      if (!this.cronJobs.has(agent.id)) {
        try {
          const triggerConfig = agent.trigger as TriggerConfig;
          if (triggerConfig.cron) {
            console.log(`[SCHEDULER] Found new CRON agent: ${agent.id} (${agent.name})`);
            await this.createCronJob(agent.id, triggerConfig.cron, agent);
          }
        } catch (error) {
          console.error(`[SCHEDULER] Failed to create cron for new agent ${agent.id}:`, error);
        }
      }
    }

    // Remove jobs for agents that no longer exist or are inactive
    const activeAgentIds = new Set(cronAgents.map(a => a.id));
    const cronJobEntries = Array.from(this.cronJobs.entries());
    for (const [agentId, job] of cronJobEntries) {
      if (!activeAgentIds.has(agentId)) {
        console.log(`[SCHEDULER] Removing CRON job for inactive agent ${agentId}`);
        job.destroy();
        this.cronJobs.delete(agentId);
      }
    }
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
   */
  getStatus(): {
    isRunning: boolean;
    cronJobsCount: number;
    activeJobs: Array<{ agentId: number; cronExpression?: string }>;
  } {
    const activeJobs: Array<{ agentId: number; cronExpression?: string }> = [];
    
    // Note: cron jobs don't expose their expression easily, so we'll track separately if needed
    this.cronJobs.forEach((job, agentId) => {
      activeJobs.push({ agentId });
    });

    return {
      isRunning: this.isRunning,
      cronJobsCount: this.cronJobs.size,
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