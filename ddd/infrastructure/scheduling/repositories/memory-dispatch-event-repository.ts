/**
 * In-Memory Dispatch Event Repository Implementation
 * 
 * Simple in-memory implementation for development and testing
 * Can be easily replaced with a persistent database implementation
 */

import type { DispatchEvent, DispatchEventData, DispatchEventStatus } from '@/ddd/domain/scheduling/entities/dispatch-event';
import type { IDispatchEventRepository } from '@/ddd/domain/scheduling/repositories/dispatch-event-repository';
import type { TriggerType } from '@/ddd/domain/scheduling/value-objects/trigger-config';

export class MemoryDispatchEventRepository implements IDispatchEventRepository {
  private events = new Map<string, DispatchEventData>();

  async findById(id: string): Promise<DispatchEvent | null> {
    const data = this.events.get(id);
    if (!data) return null;
    
    // Import here to avoid circular dependencies
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    return DispatchEvent.fromData(data);
  }

  async save(event: DispatchEvent): Promise<void> {
    const data = event.toData();
    this.events.set(event.id, data);
  }

  async delete(id: string): Promise<void> {
    this.events.delete(id);
  }

  async findPendingEvents(limit?: number): Promise<DispatchEvent[]> {
    return await this.findByStatus('pending', limit);
  }

  async findReadyForExecution(limit?: number): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const readyEvents: DispatchEvent[] = [];
    const now = new Date();
    
    for (const data of Array.from(this.events.values())) {
      if (data.status === 'pending') {
        const event = DispatchEvent.fromData(data);
        if (event.isReadyForExecution(now)) {
          readyEvents.push(event);
        }
      }
    }
    
    // Sort by priority (highest first), then by creation time (oldest first)
    readyEvents.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.createdAt.getTime() - b.createdAt.getTime(); // Older first
    });
    
    return limit ? readyEvents.slice(0, limit) : readyEvents;
  }

  async findProcessingEvents(): Promise<DispatchEvent[]> {
    return await this.findByStatus('processing');
  }

  async findTimedOutEvents(timeoutMs: number): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const timedOutEvents: DispatchEvent[] = [];
    const now = new Date();
    
    for (const data of Array.from(this.events.values())) {
      if (data.status === 'processing') {
        const event = DispatchEvent.fromData(data);
        if (event.hasTimedOut(timeoutMs, now)) {
          timedOutEvents.push(event);
        }
      }
    }
    
    return timedOutEvents;
  }

  async findRetryableEvents(limit?: number): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const retryableEvents: DispatchEvent[] = [];
    
    for (const data of Array.from(this.events.values())) {
      if (data.status === 'failed') {
        const event = DispatchEvent.fromData(data);
        if (event.canRetry()) {
          retryableEvents.push(event);
        }
      }
    }
    
    // Sort by retry count (fewer retries first) and creation time
    retryableEvents.sort((a, b) => {
      if (a.retryCount !== b.retryCount) {
        return a.retryCount - b.retryCount;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    
    return limit ? retryableEvents.slice(0, limit) : retryableEvents;
  }

  async findByAgentId(agentId: number): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const agentEvents: DispatchEvent[] = [];
    
    for (const data of Array.from(this.events.values())) {
      if (data.agentId === agentId) {
        agentEvents.push(DispatchEvent.fromData(data));
      }
    }
    
    return agentEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByStatus(status: DispatchEventStatus, limit?: number): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const matchingEvents: DispatchEvent[] = [];
    
    for (const data of Array.from(this.events.values())) {
      if (data.status === status) {
        matchingEvents.push(DispatchEvent.fromData(data));
      }
    }
    
    matchingEvents.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    return limit ? matchingEvents.slice(0, limit) : matchingEvents;
  }

  async findByTriggerType(triggerType: TriggerType): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const matchingEvents: DispatchEvent[] = [];
    
    for (const data of Array.from(this.events.values())) {
      if (data.triggerType === triggerType) {
        matchingEvents.push(DispatchEvent.fromData(data));
      }
    }
    
    return matchingEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByScheduledJobId(scheduledJobId: string): Promise<DispatchEvent[]> {
    const { DispatchEvent } = await import('@/ddd/domain/scheduling/entities/dispatch-event');
    const jobEvents: DispatchEvent[] = [];
    
    for (const data of Array.from(this.events.values())) {
      if (data.scheduledJobId === scheduledJobId) {
        jobEvents.push(DispatchEvent.fromData(data));
      }
    }
    
    return jobEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async saveMultiple(events: DispatchEvent[]): Promise<void> {
    for (const event of events) {
      await this.save(event);
    }
  }

  async deleteCompletedOlderThan(cutoffDate: Date): Promise<number> {
    let deletedCount = 0;
    const toDelete: string[] = [];
    
    for (const [id, data] of Array.from(this.events.entries())) {
      if (data.status === 'completed' && data.completedAt && data.completedAt < cutoffDate) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.events.delete(id);
      deletedCount++;
    }
    
    return deletedCount;
  }

  async deleteFailedOlderThan(cutoffDate: Date): Promise<number> {
    let deletedCount = 0;
    const toDelete: string[] = [];
    
    for (const [id, data] of Array.from(this.events.entries())) {
      if (data.status === 'failed' && data.completedAt && data.completedAt < cutoffDate) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.events.delete(id);
      deletedCount++;
    }
    
    return deletedCount;
  }

  async findHighestPriorityPendingEvents(limit: number): Promise<DispatchEvent[]> {
    const pendingEvents = await this.findPendingEvents();
    
    // Sort by priority (highest first)
    pendingEvents.sort((a, b) => b.priority - a.priority);
    
    return pendingEvents.slice(0, limit);
  }

  async getEventStats(): Promise<{
    totalEvents: number;
    eventsByStatus: Record<DispatchEventStatus, number>;
    eventsByTriggerType: Record<TriggerType, number>;
    averageExecutionTime: number;
    successRate: number;
  }> {
    const totalEvents = this.events.size;
    const eventsByStatus: Record<string, number> = {};
    const eventsByTriggerType: Record<string, number> = {};
    let totalExecutionTime = 0;
    let completedWithExecutionTime = 0;
    let successfulEvents = 0;
    let totalProcessedEvents = 0;

    for (const data of Array.from(this.events.values())) {
      // Count by status
      eventsByStatus[data.status] = (eventsByStatus[data.status] || 0) + 1;
      
      // Count by trigger type
      const triggerType = data.triggerType;
      eventsByTriggerType[triggerType] = (eventsByTriggerType[triggerType] || 0) + 1;
      
      // Calculate execution times and success rate
      if (data.status === 'completed' || data.status === 'failed') {
        totalProcessedEvents++;
        
        if (data.status === 'completed') {
          successfulEvents++;
        }
        
        if (data.startedAt && data.completedAt) {
          const executionTime = data.completedAt.getTime() - data.startedAt.getTime();
          totalExecutionTime += executionTime;
          completedWithExecutionTime++;
        }
      }
    }

    const averageExecutionTime = completedWithExecutionTime > 0 
      ? totalExecutionTime / completedWithExecutionTime 
      : 0;
    
    const successRate = totalProcessedEvents > 0 
      ? (successfulEvents / totalProcessedEvents) * 100 
      : 0;

    return {
      totalEvents,
      eventsByStatus: eventsByStatus as Record<DispatchEventStatus, number>,
      eventsByTriggerType: eventsByTriggerType as Record<TriggerType, number>,
      averageExecutionTime: Math.round(averageExecutionTime),
      successRate: Math.round(successRate * 100) / 100
    };
  }

  // Utility methods for testing and debugging

  /**
   * Clear all events (useful for testing)
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Get all events as raw data (useful for debugging)
   */
  getAllRawData(): DispatchEventData[] {
    return Array.from(this.events.values());
  }

  /**
   * Get repository size
   */
  size(): number {
    return this.events.size;
  }
}