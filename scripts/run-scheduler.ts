#!/usr/bin/env tsx

import { 
  getTaskRepository,
  getTaskQueueService,
  getSchedulerService,
  taskSchedulingContainer
} from "@/ddd/application/di/scheduling-container";
import { 
  getIndexingDomainService, 
  getAgentTaskApplicationService, 
  initializeDI,
  getIndexingQueueService,
  getRagIndexRepository 
} from "@/ddd/application/di/container";
import { createNotificationClient, rawClient } from "@/lib/db/client";
import { contextAwareDb } from "@/lib/db/simple-context-proxy";
import { TaskId } from "@/ddd/domain/tasks/value-objects/task-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import type { DomainType } from "@/ddd/domain/rag/value-objects";
import type { RagReindexEvent, TaskEvent } from "@/ddd/domain/scheduling";
import postgres from "postgres";

/**
 * Event-Driven Scheduler
 * Listens to PostgreSQL events and orchestrates task execution and RAG reindexing
 */
class EventDrivenScheduler {
  private notificationClient: postgres.Sql | null = null;
  private ragDebounceMap = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;
  private fallbackTimer: NodeJS.Timeout | null = null;

  constructor(
    private agentTaskService = getAgentTaskApplicationService(),
    private indexingDomainService = getIndexingDomainService(),
    private schedulerService = getSchedulerService(),
    private taskRepository = getTaskRepository(),
    private taskQueueService = getTaskQueueService(),
    private indexingQueueService = getIndexingQueueService(),
    private ragIndexRepository = getRagIndexRepository()
  ) {}

  async start(): Promise<void> {
    console.log('🚀 Starting Event-Driven Scheduler...');
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);

    try {
      // 1. Setup PostgreSQL event listeners
      await this.setupEventListeners();
      console.log('✅ PostgreSQL event listeners configured');

      // 2. Start fallback timer for scheduled tasks (30 second)
      this.startFallbackTimer();
      console.log('⏰ Fallback timer started (30 second intervals)');

      // 3. Process any existing queued tasks on startup
      await this.processQueuedTasks();
      console.log('📋 Initial queue processed');

      console.log('✅ Event-Driven Scheduler started successfully');
      console.log('🎧 Listening for task_event and rag_reindex_needed events...');

    } catch (error) {
      console.error('❌ Failed to start scheduler:', error);
      throw error;
    }
  }

  private async setupEventListeners(): Promise<void> {
    this.notificationClient = createNotificationClient();

    // Listen for task events (primarily MANUAL triggers via database)
    await this.notificationClient.listen('task_event', async (payload) => {
      try {
        const event = JSON.parse(payload);
        console.log(`📨 Received task_event: taskId=${event.taskId}`);
        await this.handleTaskEvent(event);
      } catch (error) {
        console.error('❌ Error handling task_event:', error);
      }
    });

    // Listen for RAG reindex events
    await this.notificationClient.listen('rag_reindex_needed', async (payload) => {
      try {
        const event = JSON.parse(payload);
        console.log(`📨 Received rag_reindex_needed: org=${event.organizationId}, type=${event.domainType}`);
        await this.handleRagReindexEvent(event);
      } catch (error) {
        console.error('❌ Error handling rag_reindex_needed:', error);
      }
    });
  }

  private async handleTaskEvent(event: TaskEvent): Promise<void> {
    // Process single task immediately
    if (!event.taskId) {
      console.warn('⚠️ task_event missing taskId');
      return;
    }

    const task = await this.taskRepository.findById(TaskId.fromString(event.taskId));
    if (task && task.isPending) {
      await this.agentTaskService.executeTask({ taskId: event.taskId });
      console.log(`✅ Processed task ${event.taskId}`);
    } else {
      console.log(`⏭️ Skipping task ${event.taskId} (not found or not pending)`);
    }
  }

  private async handleRagReindexEvent(event: RagReindexEvent): Promise<void> {
    try {
      const organizationId = OrganizationId.fromNumber(event.organizationId);
      const domainType = event.domainType as DomainType;

      console.log(`🔄 Queuing reindex for org=${event.organizationId}, type=${event.domainType}`);

      // Get existing indexes for this organization
      const indexes = await this.ragIndexRepository.findByOrganization(organizationId);

      if (indexes.length === 0) {
        // No indexes exist, create a default index first, then queue initial indexing
        console.log(`[SCHEDULER] No indexes found for org ${event.organizationId}, creating default index`);
        
        try {
          // Create default index using domain service helper
          const defaultIndex = await this.createDefaultIndex(organizationId);
          
          // Now queue initial indexing for the newly created index
          await this.indexingQueueService.enqueue({
            indexId: defaultIndex.id.value,
            operation: 'initial',
            domainType,
            maxRetries: 3
          });
          
          console.log(`📥 Created default index and queued initial indexing for org=${event.organizationId}, type=${event.domainType}`);
        } catch (error) {
          console.error(`❌ Failed to create default index for org ${event.organizationId}:`, error);
          return;
        }
      } else {
        // Queue reindex for each existing index
        console.log(`[SCHEDULER] Found ${indexes.length} indexes for org ${event.organizationId}, queuing reindex operations`);
        
        for (const index of indexes) {
          await this.indexingQueueService.enqueue({
            indexId: index.id.value,
            operation: 'reindex',
            domainType,
            maxRetries: 3
          });
          console.log(`📥 Queued reindex for index ${index.name} (${index.id.value.substring(0, 8)})`);
        }
        
        console.log(`📥 Queued ${indexes.length} reindex operations for org=${event.organizationId}, type=${event.domainType}`);
      }
    } catch (error) {
      console.error(`❌ Failed to queue reindex operations for org ${event.organizationId}:`, error);
    }
  }

  /**
   * Create a default RAG index for an organization (extracted from domain service logic)
   */
  private async createDefaultIndex(organizationId: OrganizationId) {
    const { RagIndex } = await import('@/ddd/domain/rag/entities/rag-index');
    
    const defaultIndex = RagIndex.create({
      name: 'Organization Knowledge Base',
      description: 'Automatic RAG index for organizational data - covers all tables, agents, teams, databases, and files',
      organizationId,
      domainTypes: ['tables', 'agents', 'teams', 'organizations', 'databases', 'files']
    });

    await this.ragIndexRepository.save(defaultIndex);
    console.log(`[SCHEDULER] Created default index "${defaultIndex.name}" for organization ${organizationId.value}`);
    
    return defaultIndex;
  }

  private startFallbackTimer(): void {
    // Reduced frequency - 5 minutes instead of 30 seconds
    this.fallbackTimer = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        // Process scheduled tasks (CALENDAR triggers)
        await this.processScheduledTasks();
        
        // Handle timeouts
        await this.processTimeouts();
        
        // Process retries
        await this.processRetries();
      } catch (error) {
        console.error('❌ Error in fallback timer:', error);
      }
    }, 300000); // 5 minutes
  }

  private async processScheduledTasks(): Promise<void> {
    // Handle CALENDAR triggers
    const dueTasks = await this.schedulerService.getTasksDueForExecution();
    
    if (dueTasks.length > 0) {
      console.log(`⏰ Processing ${dueTasks.length} scheduled tasks`);
      
      for (const task of dueTasks) {
        try {
          await this.taskRepository.save(task);
          await this.agentTaskService.executeTask({ taskId: task.id.value });
        } catch (error) {
          console.error(`❌ Failed to process scheduled task ${task.id.value}:`, error);
        }
      }
    }
  }

  private async processQueuedTasks(): Promise<void> {
    const readyTasks = await this.taskQueueService.getReadyTasks(10);
    
    for (const task of readyTasks) {
      try {
        await this.agentTaskService.executeTask({ taskId: task.id.value });
      } catch (error) {
        console.error(`❌ Failed to process queued task ${task.id.value}:`, error);
      }
    }
  }

  private async processTimeouts(): Promise<void> {
    const timedOutTasks = await this.taskQueueService.getTimedOutTasks();
    
    for (const task of timedOutTasks) {
      try {
        task.timeout();
        await this.taskRepository.save(task);
        await this.taskQueueService.markTaskFailed(task.id, 'Task execution timed out');
        console.log(`⏱️ Marked task ${task.id.value} as timed out`);
      } catch (error) {
        console.error(`❌ Failed to handle timeout for task ${task.id.value}:`, error);
      }
    }
  }

  private async processRetries(): Promise<void> {
    const retryTasks = await this.taskQueueService.getRetryableTasks(3);
    
    for (const task of retryTasks) {
      try {
        await this.taskQueueService.enqueue(task, 2); // Higher priority for retries
        console.log(`🔁 Requeued task ${task.id.value} for retry`);
      } catch (error) {
        console.error(`❌ Failed to requeue retry task ${task.id.value}:`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Event-Driven Scheduler...');
    this.isShuttingDown = true;

    // Clear timers
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
    }

    // Clear debounce timers
    for (const timer of this.ragDebounceMap.values()) {
      clearTimeout(timer);
    }
    this.ragDebounceMap.clear();

    // Close notification client
    if (this.notificationClient) {
      await this.notificationClient.end();
    }

    console.log('✅ Scheduler shutdown complete');
  }
}

// Main execution
async function main() {
  // Environment validation
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Initialize DI containers
  try {
    initializeDI(contextAwareDb, rawClient);
    console.log('✅ DI Container initialized for scheduler');
    
    taskSchedulingContainer.initialize(contextAwareDb, rawClient);
    console.log('✅ TaskScheduling Container initialized for scheduler');
  } catch (error) {
    console.error('❌ Failed to initialize DI containers:', error);
    process.exit(1);
  }

  const scheduler = new EventDrivenScheduler();

  // Setup signal handlers
  process.on('SIGINT', async () => {
    await scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await scheduler.shutdown();
    process.exit(0);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });

  // Start the scheduler
  try {
    await scheduler.start();
    
    // Keep process alive
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Start the scheduler
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});