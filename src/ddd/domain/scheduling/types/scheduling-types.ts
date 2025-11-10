/**
 * Consolidated Scheduling Types
 * 
 * Common interfaces and types used across the scheduling domain
 */

import type { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import type { TriggerConfig, DatabaseOperation } from '../value-objects/trigger-config';
import type { ScheduleConfiguration } from '@/ddd/domain/agents/entities/agent';

/**
 * Request to execute a task (immediately or scheduled)
 */
export interface TaskExecutionRequest {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  skillName?: string;
  instructions: TaskInstructions;
  priority?: number;
  scheduledFor?: Date;
  createdBy?: UserId;
}

/**
 * Request to schedule a recurring task
 * AIDEV-NOTE: Updated to use full ScheduleConfiguration with task instructions
 */
export interface ScheduleTaskRequest {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  skillName?: string;
  instructions: TaskInstructions;
  schedule: ScheduleConfiguration;
}

/**
 * Scheduled task information (for UI display and management)
 */
export interface ScheduledTask {
  agentId: AgentId;
  organizationId: OrganizationId;
  name: string;
  skillName?: string;
  instructions: TaskInstructions;
  trigger: TriggerConfig;
  isActive: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
  executionCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Task processing statistics
 */
export interface TaskProcessingStats {
  processed: number;
  failed: number;
  queued: number;
}

/**
 * Comprehensive execution statistics
 */
export interface ExecutionStats {
  taskStats: {
    totalTasks: number;
    tasksByStatus: Record<string, number>;
    averageExecutionTime: number;
    successRate: number;
  };
  queueStats: {
    totalQueued: number;
    processing: number;
    pendingRetry: number;
    averageWaitTime: number;
  };
  schedulerStats: {
    totalScheduledTasks: number;
    activeTasks: number;
    tasksByTriggerType: Record<string, number>;
    averageSuccessRate: number;
  };
}

/**
 * Cleanup operation result
 */
export interface CleanupResult {
  tasksDeleted: number;
  queueCleared: number;
}

/**
 * RAG reindexing event data (from database notifications)
 */
export interface RagReindexEvent {
  organizationId: number;
  domainType: string;
  changeType: 'INSERT' | 'UPDATE' | 'DELETE';
  sourceId: string;
  metadata?: Record<string, any>;
}

/**
 * Task event data (from database notifications)
 */
export interface TaskEvent {
  taskId: string;
  agentId: string;
  organizationId: number;
  instructions: string;
  tools: string[];
  servers: string[];
  userId: string;
  // Optional properties for database event triggers
  tableId?: string;
  operation?: string;
  data?: any;
}

/**
 * Table change event - immutable snapshot of table operation
 * Stored in Task.triggerContext for agent execution context
 *
 * AIDEV-NOTE: rowData is a plain object snapshot that can be reconstructed
 * into a Row entity using Row.fromPlainObject(rowData, tableId, tableFields)
 * This allows agents to access type-safe Row entity methods when needed.
 */
export interface TableChangeEvent {
  tableId: number;                        // Table ID (matches TableId.value type)
  tableName: string;
  operation: DatabaseOperation;
  organizationId: OrganizationId;
  rowId: string;
  rowData: Record<string, any>;           // Snapshot with field IDs as keys
  previousRowData?: Record<string, any>;  // For UPDATE operations
  timestamp: Date;
}

/**
 * Event dispatcher configuration
 */
export interface EventDispatcherConfig {
  fallbackTimerMs: number;
  ragDebounceMs: number;
  maxConcurrentTasks: number;
  retryDelayMs: number;
  maxRetries: number;
  timeoutMs: number;
}