// AIDEV-NOTE: Context Mapping Application Service
// Handles context table attachment for agents, skills, and steps
// Part of Context Sync infrastructure - enables agent workspace ↔ dynamic tables sync

import type { IContextMappingRepository } from '@/ddd/domain/context/repositories/context-mapping-repository';
import type {
  ContextMapping,
  CreateContextMappingData,
  UpdateContextMappingData,
  ContextMappingTargetType,
} from '@/ddd/domain/context/entities/context-mapping';

export interface AttachContextTableInput {
  organizationId: number;
  targetType: ContextMappingTargetType;
  targetId: string;
  tableId: number;
  tableName: string;
  accessMode?: 'read' | 'write' | 'readwrite';
  syncMode?: 'on_access' | 'on_save' | 'realtime';
  createdBy?: string;
}

export interface ResolvedContext {
  /** All mappings merged with hierarchy priority */
  mappings: ContextMapping[];
  /** Mappings by table ID for quick lookup */
  byTableId: Map<number, ContextMapping>;
  /** Tables with read access */
  readTables: ContextMapping[];
  /** Tables with write access */
  writeTables: ContextMapping[];
}

export class ContextMappingApplicationService {
  constructor(
    private readonly contextMappingRepository: IContextMappingRepository
  ) {}

  /**
   * Attach a table to an agent/skill/step as context
   */
  async attachContextTable(input: AttachContextTableInput): Promise<ContextMapping> {
    return this.contextMappingRepository.upsert({
      organizationId: input.organizationId,
      targetType: input.targetType,
      targetId: input.targetId,
      tableId: input.tableId,
      tableName: input.tableName,
      accessMode: input.accessMode,
      syncMode: input.syncMode,
      createdBy: input.createdBy,
    });
  }

  /**
   * Detach a table from context
   */
  async detachContextTable(mappingId: number): Promise<void> {
    const mapping = await this.contextMappingRepository.findById(mappingId);
    if (!mapping) {
      throw new Error(`Context mapping ${mappingId} not found`);
    }

    // Prevent detaching system tables
    if (mapping.isSystem) {
      throw new Error('Cannot detach system context tables');
    }

    await this.contextMappingRepository.delete(mappingId);
  }

  /**
   * Update context mapping access/sync mode
   */
  async updateContextMapping(
    mappingId: number,
    data: UpdateContextMappingData
  ): Promise<ContextMapping> {
    return this.contextMappingRepository.update(mappingId, data);
  }

  /**
   * Get all context mappings for a target
   */
  async getContextMappings(
    targetType: ContextMappingTargetType,
    targetId: string
  ): Promise<ContextMapping[]> {
    return this.contextMappingRepository.findByTarget(targetType, targetId);
  }

  /**
   * Resolve context for agent execution
   * Merges mappings respecting hierarchy: agent → skill → step
   * Later levels override earlier levels for the same table
   */
  async resolveContextForExecution(
    organizationId: number,
    agentId: number,
    skillId?: number,
    stepId?: string
  ): Promise<ResolvedContext> {
    const { agentMappings, skillMappings, stepMappings } =
      await this.contextMappingRepository.resolveForExecution(
        organizationId,
        agentId,
        skillId,
        stepId
      );

    // Merge with hierarchy priority (step > skill > agent)
    const byTableId = new Map<number, ContextMapping>();

    // Agent level (lowest priority)
    for (const mapping of agentMappings) {
      byTableId.set(mapping.tableId.value, mapping);
    }

    // Skill level (overrides agent)
    for (const mapping of skillMappings) {
      byTableId.set(mapping.tableId.value, mapping);
    }

    // Step level (highest priority)
    for (const mapping of stepMappings) {
      byTableId.set(mapping.tableId.value, mapping);
    }

    const mappings = Array.from(byTableId.values());

    return {
      mappings,
      byTableId,
      readTables: mappings.filter(
        (m) => m.accessMode === 'read' || m.accessMode === 'readwrite'
      ),
      writeTables: mappings.filter(
        (m) => m.accessMode === 'write' || m.accessMode === 'readwrite'
      ),
    };
  }

  /**
   * Find all usages of a table in context mappings
   * Useful for showing warnings when deleting a table
   */
  async findTableUsages(tableId: number): Promise<ContextMapping[]> {
    return this.contextMappingRepository.findByTable(tableId);
  }

  /**
   * Clean up context mappings when target is deleted
   */
  async cleanupForTarget(
    targetType: ContextMappingTargetType,
    targetId: string
  ): Promise<void> {
    await this.contextMappingRepository.deleteByTarget(targetType, targetId);
  }
}
