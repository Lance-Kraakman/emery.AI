// AIDEV-NOTE: In-memory RAG indexing queue service
// Eliminates race conditions by ensuring sequential processing per index
// Handles retries and failure states gracefully

import { DomainType } from '@/ddd/domain/rag/value-objects';

export interface QueueEntry {
  id: string;                    // UUID for operation tracking
  indexId: string;              // target index
  operation: 'initial' | 'reindex' | 'data-change';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  domainType?: DomainType;      // for targeted operations
  sourceId?: string;            // for data-change operations  
  changeType?: string;          // INSERT, UPDATE, DELETE for data-change
  retryCount: number;           // current attempt
  maxRetries: number;           // failure threshold
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  error?: string;               // last error message
}

export interface QueueOperationRequest {
  indexId: string;
  operation: 'initial' | 'reindex' | 'data-change';
  domainType?: DomainType;
  sourceId?: string;
  changeType?: string;
  maxRetries?: number;
}

export interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  indexQueues: Record<string, number>; // indexId -> queue length
}

export class IndexingQueueService {
  private queues: Map<string, QueueEntry[]> = new Map(); // indexId -> operations[]
  private processing: Set<string> = new Set();           // currently processing indexIds
  private processInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    // Start processing queue immediately
    this.startProcessing();
  }

  /**
   * Add operation to queue for specified index
   */
  async enqueue(request: QueueOperationRequest): Promise<string> {
    if (this.isShuttingDown) {
      throw new Error('Queue is shutting down, cannot accept new operations');
    }

    const entry: QueueEntry = {
      id: crypto.randomUUID(),
      indexId: request.indexId,
      operation: request.operation,
      status: 'queued',
      domainType: request.domainType,
      sourceId: request.sourceId,
      changeType: request.changeType,
      retryCount: 0,
      maxRetries: request.maxRetries || this.getDefaultMaxRetries(request.operation),
      createdAt: new Date()
    };
    
    const queue = this.queues.get(request.indexId) || [];
    queue.push(entry);
    this.queues.set(request.indexId, queue);
    
    console.log(`[INDEXING-QUEUE] Enqueued ${request.operation} operation for index ${request.indexId.substring(0, 8)} (${entry.id.substring(0, 8)})`);
    
    return entry.id;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    let totalQueued = 0;
    let totalProcessing = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    const indexQueues: Record<string, number> = {};

    for (const [indexId, queue] of this.queues.entries()) {
      indexQueues[indexId] = queue.length;
      
      for (const entry of queue) {
        switch (entry.status) {
          case 'queued':
            totalQueued++;
            break;
          case 'processing':
            totalProcessing++;
            break;
          case 'completed':
            totalCompleted++;
            break;
          case 'failed':
            totalFailed++;
            break;
        }
      }
    }

    return {
      totalQueued,
      totalProcessing,
      totalCompleted,
      totalFailed,
      indexQueues
    };
  }

  /**
   * Wait for all queued operations to complete (useful for tests)
   */
  async waitForCompletion(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const stats = this.getStats();
      if (stats.totalQueued === 0 && stats.totalProcessing === 0) {
        console.log(`[INDEXING-QUEUE] All operations completed`);
        return;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Timeout waiting for queue completion after ${timeoutMs}ms`);
  }

  /**
   * Get operation status by ID
   */
  getOperationStatus(operationId: string): QueueEntry | null {
    for (const queue of this.queues.values()) {
      const entry = queue.find(e => e.id === operationId);
      if (entry) return { ...entry }; // Return copy to prevent mutation
    }
    return null;
  }

  /**
   * Clear completed and failed operations (keep last N for debugging)
   */
  cleanup(keepLast: number = 10): void {
    for (const [indexId, queue] of this.queues.entries()) {
      const completedOrFailed = queue.filter(e => e.status === 'completed' || e.status === 'failed');
      
      if (completedOrFailed.length > keepLast) {
        // Remove oldest completed/failed operations
        const toRemove = completedOrFailed.slice(0, completedOrFailed.length - keepLast);
        const filteredQueue = queue.filter(e => !toRemove.includes(e));
        
        if (filteredQueue.length === 0) {
          this.queues.delete(indexId);
        } else {
          this.queues.set(indexId, filteredQueue);
        }
        
        console.log(`[INDEXING-QUEUE] Cleaned up ${toRemove.length} old operations for index ${indexId.substring(0, 8)}`);
      }
    }
  }

  /**
   * Graceful shutdown - stop processing and wait for current operations
   */
  async shutdown(timeoutMs: number = 10000): Promise<void> {
    console.log(`[INDEXING-QUEUE] Shutting down queue service...`);
    this.isShuttingDown = true;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    
    // Wait for current processing to complete
    const startTime = Date.now();
    while (this.processing.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.processing.size > 0) {
      console.warn(`[INDEXING-QUEUE] Shutdown timeout - ${this.processing.size} operations still processing`);
    }
    
    console.log(`[INDEXING-QUEUE] Queue service shutdown complete`);
  }

  /**
   * Start the background processing loop
   */
  private startProcessing(): void {
    if (this.processInterval) return; // Already started
    
    console.log(`[INDEXING-QUEUE] Starting queue processing (1 second interval)`);
    
    this.processInterval = setInterval(async () => {
      if (this.isShuttingDown) return;
      
      try {
        await this.processQueues();
      } catch (error) {
        console.error(`[INDEXING-QUEUE] Error in queue processing:`, error);
      }
      
      // Periodic cleanup every 10 processing cycles
      if (Math.random() < 0.1) {
        this.cleanup();
      }
    }, 1000); // Process every 1 second
  }

  /**
   * Process all queues - one operation per index at a time
   */
  private async processQueues(): Promise<void> {
    for (const [indexId, queue] of this.queues.entries()) {
      // Skip if already processing this index
      if (this.processing.has(indexId)) continue;
      
      // Get next queued operation
      const nextEntry = queue.find(entry => entry.status === 'queued');
      if (!nextEntry) continue;
      
      // Mark as processing
      this.processing.add(indexId);
      nextEntry.status = 'processing';
      nextEntry.processingStartedAt = new Date();
      
      console.log(`[INDEXING-QUEUE] Processing ${nextEntry.operation} for index ${indexId.substring(0, 8)} (${nextEntry.id.substring(0, 8)})`);
      
      try {
        await this.executeOperation(nextEntry);
        nextEntry.status = 'completed';
        nextEntry.completedAt = new Date();
        console.log(`[INDEXING-QUEUE] Completed ${nextEntry.operation} for index ${indexId.substring(0, 8)}`);
      } catch (error) {
        await this.handleOperationFailure(nextEntry, error as Error);
      } finally {
        this.processing.delete(indexId);
      }
    }
  }

  /**
   * Execute a single queue operation
   */
  private async executeOperation(entry: QueueEntry): Promise<void> {
    // Import here to avoid circular dependencies
    const { getIndexingDomainService } = await import('@/ddd/application/di/container');
    const indexingService = getIndexingDomainService();
    
    switch (entry.operation) {
      case 'initial':
        await indexingService.executeInitialIndexing(entry.indexId);
        break;
      case 'reindex':
        await indexingService.executeReindex(entry.indexId, entry.domainType);
        break;
      case 'data-change':
        await indexingService.executeDataChange(
          entry.indexId, 
          entry.domainType!, 
          entry.sourceId!,
          entry.changeType || 'UPDATE'
        );
        break;
      default:
        throw new Error(`Unknown operation type: ${(entry as any).operation}`);
    }
  }

  /**
   * Handle operation failure with retry logic
   */
  private async handleOperationFailure(entry: QueueEntry, error: Error): Promise<void> {
    entry.error = error.message;
    entry.retryCount++;
    
    if (entry.retryCount < entry.maxRetries) {
      // Retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, entry.retryCount - 1), 10000);
      
      console.warn(`[INDEXING-QUEUE] Operation ${entry.id.substring(0, 8)} failed (attempt ${entry.retryCount}/${entry.maxRetries}), retrying in ${delayMs}ms:`, error.message);
      
      // Reset to queued status after delay
      setTimeout(() => {
        entry.status = 'queued';
        entry.processingStartedAt = undefined;
      }, delayMs);
    } else {
      // Max retries exceeded
      entry.status = 'failed';
      entry.completedAt = new Date();
      
      console.error(`[INDEXING-QUEUE] Operation ${entry.id.substring(0, 8)} permanently failed after ${entry.maxRetries} attempts:`, error.message);
    }
  }

  /**
   * Get default max retries based on operation type
   */
  private getDefaultMaxRetries(operation: QueueEntry['operation']): number {
    switch (operation) {
      case 'initial':
        return 3; // Most important - index creation
      case 'reindex':
        return 3; // Important - user-requested
      case 'data-change':
        return 2; // Less critical - incremental updates
      default:
        return 2;
    }
  }
}

// Singleton instance
export const indexingQueueService = new IndexingQueueService();