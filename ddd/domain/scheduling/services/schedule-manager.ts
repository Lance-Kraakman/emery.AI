/**
 * Schedule Manager Domain Service
 * 
 * Manages the lifecycle and execution timing of scheduled jobs
 */

import type { ScheduledJob } from '../entities/scheduled-job';
import { DispatchEvent } from '../entities/dispatch-event';
import type { IScheduledJobRepository } from '../repositories/scheduled-job-repository';
import type { IDispatchEventRepository } from '../repositories/dispatch-event-repository';

export interface IScheduleManager {
  /**
   * Find all jobs that are due for execution
   */
  findJobsDueForExecution(now?: Date): Promise<ScheduledJob[]>;

  /**
   * Create dispatch events for due jobs
   */
  createDispatchEventsForDueJobs(jobs: ScheduledJob[]): Promise<DispatchEvent[]>;

  /**
   * Update job execution records after dispatch
   */
  recordJobExecutions(jobs: ScheduledJob[], successful: boolean[]): Promise<void>;

  /**
   * Clean up old completed events and update job statistics
   */
  performMaintenance(): Promise<{
    deletedEvents: number;
    deactivatedJobs: number;
    errors: string[];
  }>;

  /**
   * Get scheduling system health status
   */
  getSystemHealth(): Promise<{
    totalActiveJobs: number;
    pendingEvents: number;
    processingEvents: number;
    failedJobs: number;
    systemLoad: 'low' | 'medium' | 'high';
  }>;
}

export class ScheduleManager implements IScheduleManager {
  constructor(
    private scheduledJobRepository: IScheduledJobRepository,
    private dispatchEventRepository: IDispatchEventRepository
  ) {}

  async findJobsDueForExecution(now: Date = new Date()): Promise<ScheduledJob[]> {
    // Get all active jobs that might be due
    const activeJobs = await this.scheduledJobRepository.findActiveJobs();
    
    // Filter to only jobs that are actually due
    return activeJobs.filter(job => job.isDue(now));
  }

  async createDispatchEventsForDueJobs(jobs: ScheduledJob[]): Promise<DispatchEvent[]> {
    const events: DispatchEvent[] = [];

    for (const job of jobs) {
      try {
        // Create trigger payload based on job configuration
        const triggerPayload = this.createTriggerPayload(job);
        
        const event = DispatchEvent.create({
          agentId: job.agentId,
          scheduledJobId: job.id,
          triggerType: job.triggerConfig.type,
          triggerPayload,
          priority: this.calculatePriority(job),
          maxRetries: 3
        });

        events.push(event);
      } catch (error) {
        console.error(`Failed to create dispatch event for job ${job.id}:`, error);
      }
    }

    // Save all events
    if (events.length > 0) {
      await this.dispatchEventRepository.saveMultiple(events);
    }

    return events;
  }

  async recordJobExecutions(jobs: ScheduledJob[], successful: boolean[]): Promise<void> {
    if (jobs.length !== successful.length) {
      throw new Error('Jobs and successful arrays must have the same length');
    }

    const updatedJobs: ScheduledJob[] = [];

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const success = successful[i];
      
      const updatedJob = job.recordExecution(success);
      updatedJobs.push(updatedJob);
    }

    await this.scheduledJobRepository.saveMultiple(updatedJobs);
  }

  async performMaintenance(): Promise<{
    deletedEvents: number;
    deactivatedJobs: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedEvents = 0;
    let deactivatedJobs = 0;

    try {
      // Clean up old completed events (older than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      deletedEvents += await this.dispatchEventRepository.deleteCompletedOlderThan(sevenDaysAgo);
      
      // Clean up old failed events (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      deletedEvents += await this.dispatchEventRepository.deleteFailedOlderThan(thirtyDaysAgo);
    } catch (error) {
      errors.push(`Failed to clean up old events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Deactivate jobs that have exceeded failure thresholds
      const failedJobs = await this.scheduledJobRepository.findJobsWithFailures(5);
      
      for (const job of failedJobs) {
        if (job.hasExceededFailureThreshold(5)) {
          const deactivatedJob = job.setActive(false);
          await this.scheduledJobRepository.save(deactivatedJob);
          deactivatedJobs++;
        }
      }
    } catch (error) {
      errors.push(`Failed to deactivate failed jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { deletedEvents, deactivatedJobs, errors };
  }

  async getSystemHealth(): Promise<{
    totalActiveJobs: number;
    pendingEvents: number;
    processingEvents: number;
    failedJobs: number;
    systemLoad: 'low' | 'medium' | 'high';
  }> {
    const [jobStats, eventStats, pendingEvents, processingEvents, failedJobs] = await Promise.all([
      this.scheduledJobRepository.getJobStats(),
      this.dispatchEventRepository.getEventStats(),
      this.dispatchEventRepository.findPendingEvents(),
      this.dispatchEventRepository.findProcessingEvents(),
      this.scheduledJobRepository.findJobsWithFailures(3)
    ]);

    // Determine system load based on pending and processing events
    const totalActiveEvents = pendingEvents.length + processingEvents.length;
    let systemLoad: 'low' | 'medium' | 'high';
    
    if (totalActiveEvents < 10) {
      systemLoad = 'low';
    } else if (totalActiveEvents < 50) {
      systemLoad = 'medium';
    } else {
      systemLoad = 'high';
    }

    return {
      totalActiveJobs: jobStats.activeJobs,
      pendingEvents: pendingEvents.length,
      processingEvents: processingEvents.length,
      failedJobs: failedJobs.length,
      systemLoad
    };
  }

  private createTriggerPayload(job: ScheduledJob): Record<string, any> {
    const basePayload = {
      scheduledJobId: job.id,
      agentId: job.agentId,
      triggerType: job.triggerConfig.type,
      executionTime: new Date().toISOString()
    };

    switch (job.triggerConfig.type) {
      case 'CALENDAR':
        return {
          ...basePayload,
          scheduledTime: job.nextExecution?.toISOString(),
          timezone: job.triggerConfig.timezone,
          rrule: job.triggerConfig.rrule
        };

      case 'DATABASE_EVENT':
        return {
          ...basePayload,
          tableId: job.triggerConfig.tableId,
          operations: job.triggerConfig.operations,
          conditions: job.triggerConfig.conditions
        };

      case 'RAG_REINDEX':
        return {
          ...basePayload,
          domainTypes: job.triggerConfig.domainTypes,
          debounceMs: job.triggerConfig.debounceMs
        };

      case 'WEBHOOK':
        return {
          ...basePayload,
          requiresSignature: job.triggerConfig.requiresSignature,
          allowedOrigins: job.triggerConfig.allowedOrigins
        };

      case 'MANUAL':
      default:
        return basePayload;
    }
  }

  private calculatePriority(job: ScheduledJob): number {
    let priority = 0;

    // Higher priority for jobs that have been waiting longer
    if (job.nextExecution) {
      const delayMs = Date.now() - job.nextExecution.getTime();
      priority += Math.min(delayMs / (60 * 1000), 10); // Up to 10 points for 10+ minutes delay
    }

    // Higher priority for reliable jobs (better success rate)
    const successRate = job.getSuccessRate();
    priority += successRate / 10; // Up to 10 points for 100% success rate

    // Trigger type priorities
    switch (job.triggerConfig.type) {
      case 'MANUAL':
        priority += 5; // User-initiated gets higher priority
        break;
      case 'WEBHOOK':
        priority += 3; // External triggers are important
        break;
      case 'CALENDAR':
        priority += 2; // Scheduled tasks get medium priority
        break;
      case 'DATABASE_EVENT':
      case 'RAG_REINDEX':
        priority += 1; // Background tasks get lower priority
        break;
    }

    return Math.round(priority);
  }
}