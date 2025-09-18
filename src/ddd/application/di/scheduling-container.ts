/**
 * Task Scheduling DI Container
 * 
 * Simplified container for task scheduling services following DDD patterns.
 * Replaces the complex memory-based scheduling system with proper domain services.
 * 
 * AIDEV-NOTE: This follows the same pattern as the main container but focuses
 * specifically on task scheduling and execution coordination.
 */

import type { DbClient } from '@/src/lib/db/client';
import { contextAwareDb, type ContextAwareDbClient } from '@/src/lib/db/simple-context-proxy';
import { rawClient } from '@/src/lib/db/client';
import type postgres from 'postgres';

// Task domain imports
import { ITaskRepository } from '@/src/ddd/domain/tasks/repositories/task-repository';
import { DrizzleTaskRepository } from '@/src/ddd/infrastructure/db/repositories/tasks/drizzle-task-repository';
import { ITaskQueueService, TaskQueueService } from '@/src/ddd/domain/tasks/services/task-queue-service';
import { ISchedulerService, SchedulerService } from '@/src/ddd/domain/tasks/services/scheduler-service';

// Agent repository for scheduler service
import { IAgentRepository } from '@/src/ddd/domain/agents/repositories/agent-repository';
import { DrizzleAgentRepository } from '@/src/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';


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
      // Use context-aware db client for automatic RLS context
      this.initialize(contextAwareDb, rawClient);
      console.log('✅ TaskSchedulingContainer auto-initialized with context-aware database');
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
  initialize(db: DbClient | ContextAwareDbClient, rawClient: postgres.Sql): void {
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

    // No application service needed - EventDrivenScheduler uses individual services directly

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
      ISchedulerService: this.services.get('ISchedulerService')
    };
  }

  // TaskSchedulingApplicationService removed - use individual services or AgentTaskApplicationService directly

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

// TaskSchedulingApplicationService removed - use AgentTaskApplicationService from main container instead

export const getTaskRepository = (): ITaskRepository => {
  return taskSchedulingContainer.getTaskRepository();
};

export const getTaskQueueService = (): ITaskQueueService => {
  return taskSchedulingContainer.getTaskQueueService();
};

export const getSchedulerService = (): ISchedulerService => {
  return taskSchedulingContainer.getSchedulerService();
};