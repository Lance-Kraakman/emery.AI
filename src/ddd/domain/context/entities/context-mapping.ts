// AIDEV-NOTE: ContextMapping Entity - represents a table attached to an agent/skill/step
// Enables bidirectional sync between agent workspace (parquet) and dynamic tables
// Supports hierarchy: agent → skill → skill_step (later levels can override)

import type { TableId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

/**
 * Target type for context mapping
 * Hierarchy: agent → skill → skill_step
 */
export type ContextMappingTargetType = 'agent' | 'skill' | 'skill_step';

/**
 * Access mode for context tables
 * - read: Agent can read from the table
 * - write: Agent can write to the table
 * - readwrite: Agent can read and write
 */
export type ContextMappingAccessMode = 'read' | 'write' | 'readwrite';

/**
 * Sync mode for context tables
 * - on_access: Sync when agent starts execution
 * - on_save: Sync when agent finishes execution
 * - realtime: Sync in real-time (future)
 */
export type ContextMappingSyncMode = 'on_access' | 'on_save' | 'realtime';

/**
 * ContextMapping Entity
 * Represents a table attached to an agent, skill, or skill step
 */
export interface ContextMapping {
  readonly id: number;
  readonly organizationId: OrganizationId;

  // Target (what this context is attached to)
  readonly targetType: ContextMappingTargetType;
  readonly targetId: string; // ID as string (supports UUID for steps)

  // Table being mapped
  readonly tableId: TableId;
  readonly tableName: string; // Denormalized for quick access

  // Access control
  readonly accessMode: ContextMappingAccessMode;
  readonly syncMode: ContextMappingSyncMode;

  // System tables flag (Plans, Agent Memory, Execution Logs)
  readonly isSystem: boolean;

  // Metadata
  readonly createdAt: Date;
  readonly createdBy?: UserId;
  readonly updatedAt: Date;
}

/**
 * Data for creating a new context mapping
 */
export interface CreateContextMappingData {
  organizationId: number;
  targetType: ContextMappingTargetType;
  targetId: string;
  tableId: number;
  tableName: string;
  accessMode?: ContextMappingAccessMode;
  syncMode?: ContextMappingSyncMode;
  isSystem?: boolean;
  createdBy?: string;
}

/**
 * Data for updating a context mapping
 */
export interface UpdateContextMappingData {
  accessMode?: ContextMappingAccessMode;
  syncMode?: ContextMappingSyncMode;
}

/**
 * System table definitions for auto-creation
 */
export const SYSTEM_TABLES = {
  PLANS: {
    name: 'Plans',
    description: 'Agent planning records',
  },
  AGENT_MEMORY: {
    name: 'Agent Memory',
    description: 'Long-term agent memory storage',
  },
  EXECUTION_LOGS: {
    name: 'Execution Logs',
    description: 'Task and step execution history',
  },
} as const;
