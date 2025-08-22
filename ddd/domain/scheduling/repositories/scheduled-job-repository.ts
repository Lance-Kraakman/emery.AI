/**
 * Scheduled Job Repository Interface
 * 
 * Domain repository for managing scheduled jobs persistence
 */

import type { ScheduledJob } from '../entities/scheduled-job';
import type { TriggerType } from '../value-objects/trigger-config';

export interface IScheduledJobRepository {
  // Basic CRUD operations
  findById(id: string): Promise<ScheduledJob | null>;
  findByAgentId(agentId: number): Promise<ScheduledJob[]>;
  save(job: ScheduledJob): Promise<void>;
  delete(id: string): Promise<void>;

  // Scheduling-specific queries
  findActiveJobs(): Promise<ScheduledJob[]>;
  findJobsDueForExecution(before?: Date): Promise<ScheduledJob[]>;
  findJobsByTriggerType(triggerType: TriggerType): Promise<ScheduledJob[]>;
  findJobsWithFailures(minFailureCount: number): Promise<ScheduledJob[]>;

  // Batch operations
  saveMultiple(jobs: ScheduledJob[]): Promise<void>;
  deactivateJobsForAgent(agentId: number): Promise<void>;
  deleteJobsForAgent(agentId: number): Promise<void>;

  // Statistics and monitoring
  getJobStats(): Promise<{
    totalJobs: number;
    activeJobs: number;
    jobsByTriggerType: Record<TriggerType, number>;
    averageSuccessRate: number;
  }>;
}