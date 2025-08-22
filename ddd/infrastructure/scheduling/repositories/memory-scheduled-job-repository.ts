/**
 * In-Memory Scheduled Job Repository Implementation
 * 
 * Simple in-memory implementation for development and testing
 * Can be easily replaced with a persistent database implementation
 */

import type { ScheduledJob, ScheduledJobData } from '@/ddd/domain/scheduling/entities/scheduled-job';
import type { IScheduledJobRepository } from '@/ddd/domain/scheduling/repositories/scheduled-job-repository';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';

export class MemoryScheduledJobRepository implements IScheduledJobRepository {
  private jobs = new Map<string, ScheduledJobData>();

  async findById(id: string): Promise<ScheduledJob | null> {
    const data = this.jobs.get(id);
    if (!data) return null;
    
    // Import here to avoid circular dependencies
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    return ScheduledJob.fromData(data);
  }

  async findByAgentId(agentId: number): Promise<ScheduledJob[]> {
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    const jobsForAgent: ScheduledJob[] = [];
    
    for (const data of Array.from(this.jobs.values())) {
      if (data.agentId === agentId) {
        jobsForAgent.push(ScheduledJob.fromData(data));
      }
    }
    
    return jobsForAgent.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async save(job: ScheduledJob): Promise<void> {
    const data = job.toData();
    this.jobs.set(job.id, data);
  }

  async delete(id: string): Promise<void> {
    this.jobs.delete(id);
  }

  async findActiveJobs(): Promise<ScheduledJob[]> {
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    const activeJobs: ScheduledJob[] = [];
    
    for (const data of Array.from(this.jobs.values())) {
      if (data.isActive) {
        activeJobs.push(ScheduledJob.fromData(data));
      }
    }
    
    return activeJobs.sort((a, b) => {
      // Sort by next execution time (jobs due sooner first)
      const aNext = a.nextExecution?.getTime() || Infinity;
      const bNext = b.nextExecution?.getTime() || Infinity;
      return aNext - bNext;
    });
  }

  async findJobsDueForExecution(before: Date = new Date()): Promise<ScheduledJob[]> {
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    const dueJobs: ScheduledJob[] = [];
    
    for (const data of Array.from(this.jobs.values())) {
      if (data.isActive && data.nextExecution && data.nextExecution <= before) {
        dueJobs.push(ScheduledJob.fromData(data));
      }
    }
    
    return dueJobs.sort((a, b) => {
      const aNext = a.nextExecution?.getTime() || 0;
      const bNext = b.nextExecution?.getTime() || 0;
      return aNext - bNext;
    });
  }

  async findJobsByTriggerType(triggerType: TriggerType): Promise<ScheduledJob[]> {
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    const matchingJobs: ScheduledJob[] = [];
    
    for (const data of Array.from(this.jobs.values())) {
      if (data.triggerConfig.type === triggerType) {
        matchingJobs.push(ScheduledJob.fromData(data));
      }
    }
    
    return matchingJobs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findJobsWithFailures(minFailureCount: number): Promise<ScheduledJob[]> {
    const { ScheduledJob } = await import('@/ddd/domain/scheduling/entities/scheduled-job');
    const failedJobs: ScheduledJob[] = [];
    
    for (const data of Array.from(this.jobs.values())) {
      if (data.failureCount >= minFailureCount) {
        failedJobs.push(ScheduledJob.fromData(data));
      }
    }
    
    return failedJobs.sort((a, b) => b.failureCount - a.failureCount);
  }

  async saveMultiple(jobs: ScheduledJob[]): Promise<void> {
    for (const job of jobs) {
      await this.save(job);
    }
  }

  async deactivateJobsForAgent(agentId: number): Promise<void> {
    const jobs = await this.findByAgentId(agentId);
    
    for (const job of jobs) {
      if (job.isActive) {
        const deactivatedJob = job.setActive(false);
        await this.save(deactivatedJob);
      }
    }
  }

  async deleteJobsForAgent(agentId: number): Promise<void> {
    const jobsToDelete: string[] = [];
    
    for (const [id, data] of Array.from(this.jobs.entries())) {
      if (data.agentId === agentId) {
        jobsToDelete.push(id);
      }
    }
    
    for (const id of jobsToDelete) {
      this.jobs.delete(id);
    }
  }

  async getJobStats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    jobsByTriggerType: Record<TriggerType, number>;
    averageSuccessRate: number;
  }> {
    const totalJobs = this.jobs.size;
    let activeJobs = 0;
    const jobsByTriggerType: Record<string, number> = {};
    let totalExecutions = 0;
    let totalFailures = 0;

    for (const data of Array.from(this.jobs.values())) {
      if (data.isActive) {
        activeJobs++;
      }
      
      const triggerType = data.triggerConfig.type;
      jobsByTriggerType[triggerType] = (jobsByTriggerType[triggerType] || 0) + 1;
      
      totalExecutions += data.executionCount;
      totalFailures += data.failureCount;
    }

    const averageSuccessRate = totalExecutions > 0 
      ? ((totalExecutions - totalFailures) / totalExecutions) * 100 
      : 0;

    return {
      totalJobs,
      activeJobs,
      jobsByTriggerType: jobsByTriggerType as Record<TriggerType, number>,
      averageSuccessRate: Math.round(averageSuccessRate * 100) / 100
    };
  }

  // Utility methods for testing and debugging

  /**
   * Clear all jobs (useful for testing)
   */
  clear(): void {
    this.jobs.clear();
  }

  /**
   * Get all jobs as raw data (useful for debugging)
   */
  getAllRawData(): ScheduledJobData[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get repository size
   */
  size(): number {
    return this.jobs.size;
  }
}