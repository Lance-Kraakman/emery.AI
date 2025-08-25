/**
 * Agent DI Container
 * 
 * Dependency injection container for agent-related services and repositories.
 * Delegates to main DI container for repositories with database access.
 * 
 * AIDEV-NOTE: Simplified agent container that delegates to main container
 * for database-backed repositories and provides agent-specific services
 */

// Domain repositories (interfaces)
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITaskRepository } from '@/ddd/domain/agents/repositories/task-repository';
import type { IAgentExecutionRepository } from '@/ddd/domain/agents/repositories/agent-execution-repository';

// Application services
import { AgentTaskApplicationService } from '@/ddd/application/services/agents/agent-task-application-service';

// Import from main container
import {
  getAgentRepository as getMainAgentRepository,
  getTaskRepository as getMainTaskRepository,
  getAgentExecutionRepository as getMainAgentExecutionRepository
} from '@/ddd/application/di/container';

/**
 * Get agent repository instance (delegates to main container)
 */
export function getAgentRepository(): IAgentRepository {
  return getMainAgentRepository();
}

/**
 * Get task repository instance (delegates to main container)
 */
export function getTaskRepository(): ITaskRepository {
  return getMainTaskRepository();
}

/**
 * Get agent execution repository instance (delegates to main container)
 */
export function getAgentExecutionRepository(): IAgentExecutionRepository {
  return getMainAgentExecutionRepository();
}

/**
 * Get agent task application service instance (delegates to main container)
 */
export function getAgentTaskApplicationService(): AgentTaskApplicationService {
  // Import from main container
  const { getAgentTaskApplicationService: getMainAgentTaskApplicationService } = require('@/ddd/application/di/container');
  return getMainAgentTaskApplicationService();
}

/**
 * Initialize all agent services (delegates to main container)
 */
export function initializeAgentContainer(): void {
  console.log('[AGENT-CONTAINER] Agent services available via main DI container');
  // No initialization needed - delegates to main container
}

/**
 * Reset container (delegates to main container)
 */
export function resetAgentContainer(): void {
  console.log('[AGENT-CONTAINER] Agent container reset (delegates to main container)');
  // No reset needed - delegates to main container
}