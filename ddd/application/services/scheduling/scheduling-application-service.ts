/**
 * Scheduling Application Service
 * 
 * Main orchestrator for the scheduling domain - coordinates between domain services
 * and provides the primary interface for scheduling operations
 */

import { ScheduledJob } from '@/ddd/domain/scheduling/entities/scheduled-job';
import { DispatchEvent } from '@/ddd/domain/scheduling/entities/dispatch-event';
import type { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { IScheduleManager } from '@/ddd/domain/scheduling/services/schedule-manager';
import type { IEventDispatcher } from '@/ddd/domain/scheduling/services/event-dispatcher';
import type { IScheduledJobRepository } from '@/ddd/domain/scheduling/repositories/scheduled-job-repository';
import type { IDispatchEventRepository } from '@/ddd/domain/scheduling/repositories/dispatch-event-repository';

export interface CreateScheduledJobRequest {
  agentId: number;
  name: string;
  description?: string;
  triggerConfig: TriggerConfig;
  isActive?: boolean;
}

export interface SchedulingSystemStatus {
  health: {
    totalActiveJobs: number;
    pendingEvents: number;
    processingEvents: number;
    failedJobs: number;
    systemLoad: 'low' | 'medium' | 'high';
  };
  stats: {
    jobStats: any;
    eventStats: any;
  };
  maintenanceResult?: {
    deletedEvents: number;
    deactivatedJobs: number;
    errors: string[];
  };
}

export interface ProcessSchedulingCycleResult {
  dueJobs: number;
  eventsCreated: number;
  eventsProcessed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export class SchedulingApplicationService {
  constructor(
    private scheduleManager: IScheduleManager,
    private eventDispatcher: IEventDispatcher,
    private scheduledJobRepository: IScheduledJobRepository,
    private dispatchEventRepository: IDispatchEventRepository
  ) {}

  /**
   * Create a new scheduled job
   */
  async createScheduledJob(request: CreateScheduledJobRequest): Promise<ScheduledJob> {
    const job = ScheduledJob.create({
      agentId: request.agentId,
      name: request.name,
      description: request.description,
      triggerConfig: request.triggerConfig,
      isActive: request.isActive ?? true
    });

    await this.scheduledJobRepository.save(job);
    return job;
  }

  /**
   * Get a scheduled job by ID
   */
  async getScheduledJob(id: string): Promise<ScheduledJob | null> {
    return await this.scheduledJobRepository.findById(id);
  }

  /**
   * Get all scheduled jobs for an agent
   */
  async getScheduledJobsForAgent(agentId: number): Promise<ScheduledJob[]> {
    return await this.scheduledJobRepository.findByAgentId(agentId);
  }

  /**
   * Update a scheduled job's trigger configuration
   */
  async updateJobTriggerConfig(jobId: string, triggerConfig: TriggerConfig): Promise<ScheduledJob> {
    const job = await this.scheduledJobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Scheduled job not found: ${jobId}`);
    }

    const updatedJob = job.updateTriggerConfig(triggerConfig);
    await this.scheduledJobRepository.save(updatedJob);
    return updatedJob;
  }

  /**
   * Activate or deactivate a scheduled job
   */
  async setJobActive(jobId: string, isActive: boolean): Promise<ScheduledJob> {
    const job = await this.scheduledJobRepository.findById(jobId);
    if (!job) {
      throw new Error(`Scheduled job not found: ${jobId}`);
    }

    const updatedJob = job.setActive(isActive);
    await this.scheduledJobRepository.save(updatedJob);
    return updatedJob;
  }

  /**
   * Delete a scheduled job
   */
  async deleteScheduledJob(jobId: string): Promise<void> {
    await this.scheduledJobRepository.delete(jobId);
  }

  /**
   * Create an immediate dispatch event (for manual triggers)
   */
  async createImmediateDispatchEvent(
    agentId: number,
    triggerPayload: Record<string, any>,
    options?: {
      priority?: number;
      maxRetries?: number;
    }
  ): Promise<DispatchEvent> {
    const event = DispatchEvent.createImmediate(
      agentId,
      'MANUAL',
      triggerPayload,
      options
    );

    await this.dispatchEventRepository.save(event);
    return event;
  }

  /**
   * Process a complete scheduling cycle
   * 1. Find jobs due for execution
   * 2. Create dispatch events for them
   * 3. Process ready dispatch events
   * 4. Handle retries and timeouts
   */
  async processSchedulingCycle(maxConcurrentEvents?: number): Promise<ProcessSchedulingCycleResult> {
    const errors: string[] = [];
    let dueJobs = 0;
    let eventsCreated = 0;
    let eventsProcessed = 0;
    let successful = 0;
    let failed = 0;

    try {
      // 1. Find jobs due for execution
      const jobsDue = await this.scheduleManager.findJobsDueForExecution();
      dueJobs = jobsDue.length;

      if (jobsDue.length > 0) {
        // 2. Create dispatch events for due jobs
        const newEvents = await this.scheduleManager.createDispatchEventsForDueJobs(jobsDue);
        eventsCreated = newEvents.length;

        // Record that jobs have been scheduled (but not necessarily executed yet)
        const scheduledSuccessfully = new Array(jobsDue.length).fill(true);
        await this.scheduleManager.recordJobExecutions(jobsDue, scheduledSuccessfully);
      }
    } catch (error) {
      errors.push(`Failed to process due jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // 3. Process ready dispatch events
      const readyEvents = await this.dispatchEventRepository.findReadyForExecution(50);
      eventsProcessed = readyEvents.length;

      if (readyEvents.length > 0) {
        const processResult = await this.eventDispatcher.processEvents(readyEvents, maxConcurrentEvents);
        successful = processResult.successful;
        failed = processResult.failed;
        errors.push(...processResult.errors);
      }
    } catch (error) {
      errors.push(`Failed to process events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // 4. Handle retries
      const retryResult = await this.eventDispatcher.retryFailedEvents();
      if (retryResult.errors.length > 0) {
        errors.push(...retryResult.errors);
      }
    } catch (error) {
      errors.push(`Failed to retry events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // 5. Handle timeouts
      const timeoutResult = await this.eventDispatcher.handleTimedOutEvents();
      if (timeoutResult.errors.length > 0) {
        errors.push(...timeoutResult.errors);
      }
    } catch (error) {
      errors.push(`Failed to handle timeouts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      dueJobs,
      eventsCreated,
      eventsProcessed,
      successful,
      failed,
      errors: errors.slice(0, 10) // Limit error count to prevent overwhelming logs
    };
  }

  /**
   * Get comprehensive scheduling system status
   */
  async getSystemStatus(): Promise<SchedulingSystemStatus> {
    const [health, jobStats, eventStats] = await Promise.all([
      this.scheduleManager.getSystemHealth(),
      this.scheduledJobRepository.getJobStats(),
      this.dispatchEventRepository.getEventStats()
    ]);

    return {
      health,
      stats: {
        jobStats,
        eventStats
      }
    };
  }

  /**
   * Perform system maintenance
   */
  async performMaintenance(): Promise<SchedulingSystemStatus> {
    const maintenanceResult = await this.scheduleManager.performMaintenance();
    const status = await this.getSystemStatus();
    
    return {
      ...status,
      maintenanceResult
    };
  }

  /**
   * Get pending events for monitoring
   */
  async getPendingEvents(limit?: number): Promise<DispatchEvent[]> {
    return await this.dispatchEventRepository.findPendingEvents(limit);
  }

  /**
   * Get processing events for monitoring
   */
  async getProcessingEvents(): Promise<DispatchEvent[]> {
    return await this.dispatchEventRepository.findProcessingEvents();
  }

  /**
   * Emergency stop - deactivate all jobs
   */
  async emergencyStop(): Promise<void> {
    const activeJobs = await this.scheduledJobRepository.findActiveJobs();
    
    for (const job of activeJobs) {
      const deactivatedJob = job.setActive(false);
      await this.scheduledJobRepository.save(deactivatedJob);
    }
  }

  /**
   * Bulk activate/deactivate jobs for an agent
   */
  async setAgentJobsActive(agentId: number, isActive: boolean): Promise<void> {
    const jobs = await this.scheduledJobRepository.findByAgentId(agentId);
    
    const updatedJobs = jobs.map(job => job.setActive(isActive));
    await this.scheduledJobRepository.saveMultiple(updatedJobs);
  }
}