/**
 * Scheduling Domain Dependency Injection Container
 * 
 * Configures and provides instances of all scheduling-related services and repositories
 */

import { SchedulingApplicationService } from '../services/scheduling-application-service';
import { EventDrivenSchedulingService } from '../services/event-driven-scheduling-service';
import { ScheduleManager } from '@/ddd/domain/scheduling/services/schedule-manager';
import { EventDispatcher } from '@/ddd/domain/scheduling/services/event-dispatcher';
import type { IEventScheduler } from '@/ddd/domain/scheduling/services/event-scheduler';
import { PostgresEventScheduler } from '@/ddd/infrastructure/scheduling/services/postgres-event-scheduler';

// Import infrastructure implementations (these will be created next)
import { MemoryScheduledJobRepository } from '@/ddd/infrastructure/scheduling/repositories/memory-scheduled-job-repository';
import { MemoryDispatchEventRepository } from '@/ddd/infrastructure/scheduling/repositories/memory-dispatch-event-repository';

// Import agent task executor (existing service)
import { getAgentTaskApplicationService } from '@/ddd/application/di/agent-container';

// Import domain interfaces
import type { IScheduledJobRepository } from '@/ddd/domain/scheduling/repositories/scheduled-job-repository';
import type { IDispatchEventRepository } from '@/ddd/domain/scheduling/repositories/dispatch-event-repository';
import type { IScheduleManager } from '@/ddd/domain/scheduling/services/schedule-manager';
import type { IEventDispatcher, IAgentTaskExecutor } from '@/ddd/domain/scheduling/services/event-dispatcher';

// AIDEV-NOTE: Scheduling domain DI container setup
// Uses in-memory repositories for now, can be easily swapped to persistent implementations

class SchedulingContainer {
  private static instance: SchedulingContainer;
  
  // Repository instances
  private scheduledJobRepository!: IScheduledJobRepository;
  private dispatchEventRepository!: IDispatchEventRepository;
  
  // Domain service instances
  private scheduleManager!: IScheduleManager;
  private eventDispatcher!: IEventDispatcher;
  
  // Application service instances
  private schedulingApplicationService!: SchedulingApplicationService;
  private eventDrivenSchedulingService!: EventDrivenSchedulingService;
  
  // Event scheduling infrastructure
  private eventScheduler!: IEventScheduler;

  private constructor() {
    this.initializeContainer();
  }

  static getInstance(): SchedulingContainer {
    if (!SchedulingContainer.instance) {
      SchedulingContainer.instance = new SchedulingContainer();
    }
    return SchedulingContainer.instance;
  }

  private initializeContainer(): void {
    console.log('🏗️ Initializing Scheduling Domain DI Container...');

    // Initialize repositories
    this.scheduledJobRepository = new MemoryScheduledJobRepository();
    this.dispatchEventRepository = new MemoryDispatchEventRepository();

    // Initialize domain services
    this.scheduleManager = new ScheduleManager(
      this.scheduledJobRepository,
      this.dispatchEventRepository
    );

    // Create agent task executor adapter
    const agentTaskExecutor: IAgentTaskExecutor = {
      async executeTask(params) {
        try {
          const agentTaskService = getAgentTaskApplicationService();
          const result = await agentTaskService.createAndExecuteTask({
            agentId: params.agentId,
            name: `Scheduled execution: ${params.instructions.substring(0, 50)}...`,
            instructions: {
              instructions: params.instructions,
              tools: params.tools,
              servers: params.servers,
              metadata: params.metadata
            },
            timeoutSeconds: params.timeoutSeconds || 300
          });

          return {
            success: result.executionResult.success,
            taskId: result.task.id,
            error: result.executionResult.error
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown execution error'
          };
        }
      }
    };

    this.eventDispatcher = new EventDispatcher(
      this.dispatchEventRepository,
      agentTaskExecutor
    );

    // Initialize event scheduling infrastructure
    this.eventScheduler = new PostgresEventScheduler();

    // Initialize application services
    this.schedulingApplicationService = new SchedulingApplicationService(
      this.scheduleManager,
      this.eventDispatcher,
      this.scheduledJobRepository,
      this.dispatchEventRepository
    );

    this.eventDrivenSchedulingService = new EventDrivenSchedulingService(
      this.schedulingApplicationService,
      this.eventScheduler
    );

    console.log('✅ Scheduling Domain DI Container initialized successfully');
  }

  // Essential service getters - removed bloat, keeping only main orchestrators

  getSchedulingApplicationService(): SchedulingApplicationService {
    return this.schedulingApplicationService;
  }

  getEventDrivenSchedulingService(): EventDrivenSchedulingService {
    return this.eventDrivenSchedulingService;
  }

  getEventScheduler(): IEventScheduler {
    return this.eventScheduler;
  }

  // Utility methods for testing and monitoring

  /**
   * Reset all repositories (useful for testing)
   */
  resetRepositories(): void {
    this.scheduledJobRepository = new MemoryScheduledJobRepository();
    this.dispatchEventRepository = new MemoryDispatchEventRepository();
    
    // Reinitialize all services with fresh repositories
    this.initializeContainer();
  }

  /**
   * Get container health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    repositories: Record<string, boolean>;
    services: Record<string, boolean>;
  }> {
    const repositoryHealth = {
      scheduledJobRepository: this.scheduledJobRepository !== null,
      dispatchEventRepository: this.dispatchEventRepository !== null
    };

    const serviceHealth = {
      scheduleManager: this.scheduleManager !== null,
      eventDispatcher: this.eventDispatcher !== null,
      schedulingApplicationService: this.schedulingApplicationService !== null,
      eventDrivenSchedulingService: this.eventDrivenSchedulingService !== null,
      eventScheduler: this.eventScheduler !== null
    };

    const allHealthy = Object.values(repositoryHealth).every(h => h) && 
                      Object.values(serviceHealth).every(h => h);

    return {
      healthy: allHealthy,
      repositories: repositoryHealth,
      services: serviceHealth
    };
  }
}

// Export singleton instance functions - simplified, removed getter bloat
export const getSchedulingContainer = (): SchedulingContainer => {
  return SchedulingContainer.getInstance();
};

// Main orchestration services
export const getSchedulingApplicationService = (): SchedulingApplicationService => {
  return getSchedulingContainer().getSchedulingApplicationService();
};

export const getEventDrivenSchedulingService = (): EventDrivenSchedulingService => {
  return getSchedulingContainer().getEventDrivenSchedulingService();
};

export const getEventScheduler = (): IEventScheduler => {
  return getSchedulingContainer().getEventScheduler();
};

// Direct service exports for convenience
const container = getSchedulingContainer();
export const schedulingApplicationService = container.getSchedulingApplicationService();
export const eventDrivenSchedulingService = container.getEventDrivenSchedulingService();
export const eventScheduler = container.getEventScheduler();