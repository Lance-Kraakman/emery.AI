/**
 * Event Dispatcher Domain Service
 * 
 * Handles the execution of dispatch events by coordinating with agent task services
 */

import type { DispatchEvent } from '../entities/dispatch-event';
import type { IDispatchEventRepository } from '../repositories/dispatch-event-repository';

// External dependency interface - to be injected
export interface IAgentTaskExecutor {
  executeTask(params: {
    agentId: number;
    instructions: string;
    tools?: Array<{name: string, config?: Record<string, any>}>;
    servers?: Array<{name: string, config?: Record<string, any>}>;
    metadata?: Record<string, any>;
    timeoutSeconds?: number;
  }): Promise<{
    success: boolean;
    taskId?: string;
    error?: string;
  }>;
}

export interface IEventDispatcher {
  /**
   * Process a single dispatch event
   */
  processEvent(event: DispatchEvent): Promise<boolean>;

  /**
   * Process multiple events in priority order
   */
  processEvents(events: DispatchEvent[], maxConcurrent?: number): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }>;

  /**
   * Retry failed events that are eligible for retry
   */
  retryFailedEvents(): Promise<{
    retriedCount: number;
    errors: string[];
  }>;

  /**
   * Handle timed out events by marking them as failed
   */
  handleTimedOutEvents(timeoutMs?: number): Promise<{
    timedOutCount: number;
    errors: string[];
  }>;
}

export class EventDispatcher implements IEventDispatcher {
  private readonly DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_MAX_CONCURRENT = 10;

  constructor(
    private dispatchEventRepository: IDispatchEventRepository,
    private agentTaskExecutor: IAgentTaskExecutor
  ) {}

  async processEvent(event: DispatchEvent): Promise<boolean> {
    try {
      // Mark event as processing
      const processingEvent = event.startProcessing();
      await this.dispatchEventRepository.save(processingEvent);

      // Generate task instructions based on trigger type
      const instructions = this.generateTaskInstructions(event);
      
      // Execute the agent task
      const result = await this.agentTaskExecutor.executeTask({
        agentId: event.agentId,
        instructions,
        metadata: {
          ...event.triggerPayload,
          dispatchEventId: event.id,
          triggerType: event.triggerType
        },
        timeoutSeconds: 300 // 5 minutes
      });

      // Update event based on result
      let finalEvent: DispatchEvent;
      if (result.success) {
        finalEvent = processingEvent.markCompleted();
      } else {
        finalEvent = processingEvent.markFailed(result.error || 'Unknown execution error');
      }

      await this.dispatchEventRepository.save(finalEvent);
      return result.success;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to process dispatch event ${event.id}:`, errorMessage);

      try {
        // Try to mark the event as failed
        if (event.status === 'processing') {
          const failedEvent = event.markFailed(errorMessage);
          await this.dispatchEventRepository.save(failedEvent);
        }
      } catch (saveError) {
        console.error(`Failed to save failed event state for ${event.id}:`, saveError);
      }

      return false;
    }
  }

  async processEvents(events: DispatchEvent[], maxConcurrent = this.DEFAULT_MAX_CONCURRENT): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    // Sort events by priority (highest first)
    const sortedEvents = events.sort((a, b) => b.priority - a.priority);

    // Process events in batches to control concurrency
    for (let i = 0; i < sortedEvents.length; i += maxConcurrent) {
      const batch = sortedEvents.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(async (event) => {
        try {
          const success = await this.processEvent(event);
          return { success, eventId: event.id };
        } catch (error) {
          const errorMessage = `Event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMessage);
          return { success: false, eventId: event.id };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successful++;
          } else {
            failed++;
          }
        } else {
          failed++;
          errors.push(`Batch processing error: ${result.reason}`);
        }
      }
    }

    return { successful, failed, errors };
  }

  async retryFailedEvents(): Promise<{
    retriedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let retriedCount = 0;

    try {
      const retryableEvents = await this.dispatchEventRepository.findRetryableEvents(50);
      
      for (const event of retryableEvents) {
        try {
          if (event.canRetry()) {
            // Retry with exponential backoff delay
            const delayMs = Math.pow(2, event.retryCount) * 1000; // 1s, 2s, 4s, 8s...
            const retriedEvent = event.retry(delayMs);
            
            await this.dispatchEventRepository.save(retriedEvent);
            retriedCount++;
          }
        } catch (error) {
          errors.push(`Failed to retry event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to load retryable events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { retriedCount, errors };
  }

  async handleTimedOutEvents(timeoutMs = this.DEFAULT_TIMEOUT_MS): Promise<{
    timedOutCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let timedOutCount = 0;

    try {
      const timedOutEvents = await this.dispatchEventRepository.findTimedOutEvents(timeoutMs);
      
      for (const event of timedOutEvents) {
        try {
          const failedEvent = event.markFailed(`Execution timed out after ${timeoutMs}ms`);
          await this.dispatchEventRepository.save(failedEvent);
          timedOutCount++;
        } catch (error) {
          errors.push(`Failed to handle timed out event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to load timed out events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { timedOutCount, errors };
  }

  private generateTaskInstructions(event: DispatchEvent): string {
    const baseInstructions = `Execute task triggered by ${event.triggerType} event.`;
    
    switch (event.triggerType) {
      case 'MANUAL':
        return `${baseInstructions} This is a user-initiated manual execution. Process according to your configuration.`;

      case 'CALENDAR':
        const scheduledTime = event.triggerPayload.scheduledTime || 'unknown time';
        return `${baseInstructions} This is a scheduled execution for ${scheduledTime}. Execute according to your scheduled configuration.`;

      case 'DATABASE_EVENT':
        const operation = event.triggerPayload.operation || 'unknown operation';
        const tableName = event.triggerPayload.table_name || event.triggerPayload.tableName || 'unknown table';
        return `${baseInstructions} Database ${operation} event detected on ${tableName}. Process the change according to your configuration.`;

      case 'RAG_REINDEX':
        const domainType = event.triggerPayload.domainType || 'data';
        return `${baseInstructions} RAG reindex required for ${domainType}. Update search indexes according to your configuration.`;

      case 'WEBHOOK':
        return `${baseInstructions} Webhook request received. Process the external trigger according to your configuration.`;

      default:
        return baseInstructions;
    }
  }
}