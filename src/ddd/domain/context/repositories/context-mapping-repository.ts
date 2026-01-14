// AIDEV-NOTE: ContextMapping repository interface
// Defines data access operations for ContextMapping entities

import type {
  ContextMapping,
  CreateContextMappingData,
  UpdateContextMappingData,
  ContextMappingTargetType,
} from '../entities/context-mapping';

/**
 * Repository interface for ContextMapping persistence operations
 */
export interface IContextMappingRepository {
  /**
   * Create a new context mapping
   */
  create(data: CreateContextMappingData): Promise<ContextMapping>;

  /**
   * Update an existing context mapping
   */
  update(id: number, data: UpdateContextMappingData): Promise<ContextMapping>;

  /**
   * Find context mapping by ID
   */
  findById(id: number): Promise<ContextMapping | null>;

  /**
   * Find all context mappings for a target (agent, skill, or step)
   */
  findByTarget(targetType: ContextMappingTargetType, targetId: string): Promise<ContextMapping[]>;

  /**
   * Find all context mappings for an organization
   */
  findByOrganization(organizationId: number): Promise<ContextMapping[]>;

  /**
   * Find context mapping by target and table (unique)
   */
  findByTargetAndTable(
    targetType: ContextMappingTargetType,
    targetId: string,
    tableId: number
  ): Promise<ContextMapping | null>;

  /**
   * Find all context mappings for a table (useful for finding usages)
   */
  findByTable(tableId: number): Promise<ContextMapping[]>;

  /**
   * Find system context mappings for a target
   */
  findSystemMappings(targetType: ContextMappingTargetType, targetId: string): Promise<ContextMapping[]>;

  /**
   * Delete context mapping by ID
   */
  delete(id: number): Promise<void>;

  /**
   * Delete all context mappings for a target (cleanup on agent/skill deletion)
   */
  deleteByTarget(targetType: ContextMappingTargetType, targetId: string): Promise<void>;

  /**
   * Upsert context mapping (create if not exists, update if exists)
   * Returns the created or updated mapping
   */
  upsert(data: CreateContextMappingData): Promise<ContextMapping>;

  /**
   * Resolve context mappings for agent execution
   * Returns merged mappings respecting hierarchy: agent → skill → step
   */
  resolveForExecution(
    organizationId: number,
    agentId: number,
    skillId?: number,
    stepId?: string
  ): Promise<{
    agentMappings: ContextMapping[];
    skillMappings: ContextMapping[];
    stepMappings: ContextMapping[];
  }>;
}
