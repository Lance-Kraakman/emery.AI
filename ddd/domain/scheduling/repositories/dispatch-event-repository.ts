/**
 * Dispatch Event Repository Interface
 * 
 * Domain repository for managing dispatch events persistence
 */

import type { DispatchEvent } from '../entities/dispatch-event';
import type { TriggerType } from '../value-objects/trigger-config';
import type { DispatchEventStatus } from '../entities/dispatch-event';

export interface IDispatchEventRepository {
  // Basic CRUD operations
  findById(id: string): Promise<DispatchEvent | null>;
  save(event: DispatchEvent): Promise<void>;
  delete(id: string): Promise<void>;

  // Event processing queries
  findPendingEvents(limit?: number): Promise<DispatchEvent[]>;
  findReadyForExecution(limit?: number): Promise<DispatchEvent[]>;
  findProcessingEvents(): Promise<DispatchEvent[]>;
  findTimedOutEvents(timeoutMs: number): Promise<DispatchEvent[]>;
  findRetryableEvents(limit?: number): Promise<DispatchEvent[]>;

  // Filtering and search
  findByAgentId(agentId: number): Promise<DispatchEvent[]>;
  findByStatus(status: DispatchEventStatus): Promise<DispatchEvent[]>;
  findByTriggerType(triggerType: TriggerType): Promise<DispatchEvent[]>;
  findByScheduledJobId(scheduledJobId: string): Promise<DispatchEvent[]>;

  // Batch operations
  saveMultiple(events: DispatchEvent[]): Promise<void>;
  deleteCompletedOlderThan(cutoffDate: Date): Promise<number>;
  deleteFailedOlderThan(cutoffDate: Date): Promise<number>;

  // Priority-based querying
  findHighestPriorityPendingEvents(limit: number): Promise<DispatchEvent[]>;
  
  // Statistics and monitoring
  getEventStats(): Promise<{
    totalEvents: number;
    eventsByStatus: Record<DispatchEventStatus, number>;
    eventsByTriggerType: Record<TriggerType, number>;
    averageExecutionTime: number;
    successRate: number;
  }>;
}