/**
 * Task Scheduling DI Container
 * 
 * Simplified container for task scheduling services following DDD patterns.
 * Replaces the complex memory-based scheduling system with proper domain services.
 * 
 * AIDEV-NOTE: This follows the same pattern as the main container but focuses
 * specifically on task scheduling and execution coordination.
 */

import type { DbClient } from '@/lib/db/client';
import type postgres from 'postgres';

// Task domain imports
import { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import { DrizzleTaskRepository } from '@/ddd/infrastructure/db/repositories/tasks/drizzle-task-repository';
import { ITaskQueueService, TaskQueueService } from '@/ddd/domain/tasks/services/task-queue-service';
import { ISchedulerService, SchedulerService } from '@/ddd/domain/tasks/services/scheduler-service';
import { TaskSchedulingApplicationService } from '@/ddd/application/services/tasks/task-scheduling-application-service';

// Agent repository for scheduler service
import { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';

// RAG indexing service
import { RagIndexingApplicationService } from '@/ddd/application/services/rag/rag-indexing-application-service';

/**
 * Container interface for task scheduling services
 */
export interface TaskSchedulingServices {
  // Repository layer
  ITaskRepository: ITaskRepository;
  IAgentRepository: IAgentRepository;
  
  // Domain services
  ITaskQueueService: ITaskQueueService;
  ISchedulerService: ISchedulerService;
  
  // Application services
  TaskSchedulingApplicationService: TaskSchedulingApplicationService;
  
  // Optional RAG service
  RagIndexingApplicationService?: RagIndexingApplicationService;
}

export class TaskSchedulingContainer {
  private static instance: TaskSchedulingContainer;
  private services = new Map<string, any>();
  private isInitialized = false;

  private constructor() {
    // Auto-initialize if in server environment
    if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
      this.autoInitialize();
    }
  }

  private autoInitialize(): void {
    try {
      // Import db clients dynamically to avoid circular dependencies
      const { db, rawClient } = require('@/lib/db/client');
      this.initialize(db, rawClient);
      console.log('✅ TaskSchedulingContainer auto-initialized successfully');
    } catch (error) {
      console.warn('⚠️ TaskSchedulingContainer auto-initialization failed, will require manual initialization:', error);
    }
  }

  static getInstance(): TaskSchedulingContainer {
    if (!TaskSchedulingContainer.instance) {
      TaskSchedulingContainer.instance = new TaskSchedulingContainer();
    }
    return TaskSchedulingContainer.instance;
  }

  /**
   * Initialize the container with database clients
   */
  initialize(db: DbClient, rawClient: postgres.Sql, ragIndexingService?: RagIndexingApplicationService): void {
    if (this.isInitialized) {
      console.warn('TaskSchedulingContainer is already initialized');
      return;
    }

    // Register repositories
    const taskRepository = new DrizzleTaskRepository(db);
    const agentRepository = new DrizzleAgentRepository(db);
    
    this.services.set('ITaskRepository', taskRepository);
    this.services.set('IAgentRepository', agentRepository);

    // Register domain services
    const taskQueueService = new TaskQueueService({
      maxConcurrentTasks: 10,
      retryDelayMs: 30000,
      maxRetries: 3,
      timeoutMs: 300000
    });
    
    const schedulerService = new SchedulerService(agentRepository);
    
    this.services.set('ITaskQueueService', taskQueueService);
    this.services.set('ISchedulerService', schedulerService);

    // Register application service
    const taskSchedulingApplicationService = new TaskSchedulingApplicationService(
      taskRepository,
      taskQueueService,
      schedulerService,
      ragIndexingService
    );
    
    this.services.set('TaskSchedulingApplicationService', taskSchedulingApplicationService);
    
    // Optional RAG service
    if (ragIndexingService) {
      this.services.set('RagIndexingApplicationService', ragIndexingService);
    }

    this.isInitialized = true;
  }

  /**
   * Get all scheduling services
   */
  getServices(): TaskSchedulingServices {
    if (!this.isInitialized) {
      throw new Error('TaskSchedulingContainer not initialized. Call initialize() first.');
    }

    return {
      ITaskRepository: this.services.get('ITaskRepository'),
      IAgentRepository: this.services.get('IAgentRepository'),
      ITaskQueueService: this.services.get('ITaskQueueService'),
      ISchedulerService: this.services.get('ISchedulerService'),
      TaskSchedulingApplicationService: this.services.get('TaskSchedulingApplicationService'),
      RagIndexingApplicationService: this.services.get('RagIndexingApplicationService')
    };
  }

  /**
   * Get task scheduling application service (main entry point)
   */
  getTaskSchedulingApplicationService(): TaskSchedulingApplicationService {
    if (!this.isInitialized) {
      throw new Error('TaskSchedulingContainer not initialized. Call initialize() first.');
    }
    
    return this.services.get('TaskSchedulingApplicationService');
  }

  /**
   * Get task repository
   */
  getTaskRepository(): ITaskRepository {
    if (!this.isInitialized) {
      throw new Error('TaskSchedulingContainer not initialized. Call initialize() first.');
    }
    
    return this.services.get('ITaskRepository');
  }

  /**
   * Get task queue service
   */
  getTaskQueueService(): ITaskQueueService {
    if (!this.isInitialized) {
      throw new Error('TaskSchedulingContainer not initialized. Call initialize() first.');
    }
    
    return this.services.get('ITaskQueueService');
  }

  /**
   * Get scheduler service
   */
  getSchedulerService(): ISchedulerService {
    if (!this.isInitialized) {
      throw new Error('TaskSchedulingContainer not initialized. Call initialize() first.');
    }
    
    return this.services.get('ISchedulerService');
  }

  /**
   * Check if container is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset container (useful for testing)
   */
  reset(): void {
    this.services.clear();
    this.isInitialized = false;
    TaskSchedulingContainer.instance = null as any;
  }
}

// Export singleton instance and convenience functions
export const taskSchedulingContainer = TaskSchedulingContainer.getInstance();

// Convenience getters that match the original API
export const getTaskSchedulingApplicationService = (): TaskSchedulingApplicationService => {
  return taskSchedulingContainer.getTaskSchedulingApplicationService();
};

export const getTaskRepository = (): ITaskRepository => {
  return taskSchedulingContainer.getTaskRepository();
};

export const getTaskQueueService = (): ITaskQueueService => {
  return taskSchedulingContainer.getTaskQueueService();
};

export const getSchedulerService = (): ISchedulerService => {
  return taskSchedulingContainer.getSchedulerService();
};