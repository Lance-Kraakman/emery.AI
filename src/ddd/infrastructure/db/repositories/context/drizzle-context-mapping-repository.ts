// AIDEV-NOTE: Drizzle implementation of ContextMapping repository
// Handles data persistence for ContextMapping domain entities
// Critical for Context Sync infrastructure - enables agent workspace ↔ dynamic tables sync

import type { IContextMappingRepository } from '@/ddd/domain/context/repositories/context-mapping-repository';
import type {
  ContextMapping,
  CreateContextMappingData,
  UpdateContextMappingData,
  ContextMappingTargetType,
} from '@/ddd/domain/context/entities/context-mapping';
import { contextMappings } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { OrganizationId, UserId, TableId } from '@/ddd/domain/shared/value-objects';
import type { DbClient } from '@/ddd/infrastructure/db/client';

type ContextMappingRow = InferSelectModel<typeof contextMappings>;

export class DrizzleContextMappingRepository implements IContextMappingRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: CreateContextMappingData): Promise<ContextMapping> {
    const [record] = await this.db
      .insert(contextMappings)
      .values({
        organizationId: data.organizationId,
        targetType: data.targetType,
        targetId: data.targetId,
        tableId: data.tableId,
        tableName: data.tableName,
        accessMode: data.accessMode ?? 'read',
        syncMode: data.syncMode ?? 'on_access',
        isSystem: data.isSystem ?? false,
        createdBy: data.createdBy ?? null,
      })
      .returning();

    return this.fromPersistence(record);
  }

  async update(id: number, data: UpdateContextMappingData): Promise<ContextMapping> {
    const [record] = await this.db
      .update(contextMappings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(contextMappings.id, id))
      .returning();

    if (!record) {
      throw new Error(`ContextMapping with id ${id} not found`);
    }

    return this.fromPersistence(record);
  }

  async findById(id: number): Promise<ContextMapping | null> {
    const [record] = await this.db
      .select()
      .from(contextMappings)
      .where(eq(contextMappings.id, id))
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async findByTarget(
    targetType: ContextMappingTargetType,
    targetId: string
  ): Promise<ContextMapping[]> {
    const records = await this.db
      .select()
      .from(contextMappings)
      .where(
        and(
          eq(contextMappings.targetType, targetType),
          eq(contextMappings.targetId, targetId)
        )
      );

    return records.map((record: ContextMappingRow) => this.fromPersistence(record));
  }

  async findByOrganization(organizationId: number): Promise<ContextMapping[]> {
    const records = await this.db
      .select()
      .from(contextMappings)
      .where(eq(contextMappings.organizationId, organizationId));

    return records.map((record: ContextMappingRow) => this.fromPersistence(record));
  }

  async findByTargetAndTable(
    targetType: ContextMappingTargetType,
    targetId: string,
    tableId: number
  ): Promise<ContextMapping | null> {
    const [record] = await this.db
      .select()
      .from(contextMappings)
      .where(
        and(
          eq(contextMappings.targetType, targetType),
          eq(contextMappings.targetId, targetId),
          eq(contextMappings.tableId, tableId)
        )
      )
      .limit(1);

    return record ? this.fromPersistence(record) : null;
  }

  async findByTable(tableId: number): Promise<ContextMapping[]> {
    const records = await this.db
      .select()
      .from(contextMappings)
      .where(eq(contextMappings.tableId, tableId));

    return records.map((record: ContextMappingRow) => this.fromPersistence(record));
  }

  async findSystemMappings(
    targetType: ContextMappingTargetType,
    targetId: string
  ): Promise<ContextMapping[]> {
    const records = await this.db
      .select()
      .from(contextMappings)
      .where(
        and(
          eq(contextMappings.targetType, targetType),
          eq(contextMappings.targetId, targetId),
          eq(contextMappings.isSystem, true)
        )
      );

    return records.map((record: ContextMappingRow) => this.fromPersistence(record));
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(contextMappings).where(eq(contextMappings.id, id));
  }

  async deleteByTarget(
    targetType: ContextMappingTargetType,
    targetId: string
  ): Promise<void> {
    await this.db
      .delete(contextMappings)
      .where(
        and(
          eq(contextMappings.targetType, targetType),
          eq(contextMappings.targetId, targetId)
        )
      );
  }

  async upsert(data: CreateContextMappingData): Promise<ContextMapping> {
    // Check if mapping already exists
    const existing = await this.findByTargetAndTable(
      data.targetType,
      data.targetId,
      data.tableId
    );

    if (existing) {
      // Update existing mapping
      return this.update(existing.id, {
        accessMode: data.accessMode,
        syncMode: data.syncMode,
      });
    }

    // Create new mapping
    return this.create(data);
  }

  async resolveForExecution(
    organizationId: number,
    agentId: number,
    skillId?: number,
    stepId?: string
  ): Promise<{
    agentMappings: ContextMapping[];
    skillMappings: ContextMapping[];
    stepMappings: ContextMapping[];
  }> {
    // Fetch agent-level mappings
    const agentMappings = await this.findByTarget('agent', String(agentId));

    // Fetch skill-level mappings (if skill provided)
    const skillMappings = skillId
      ? await this.findByTarget('skill', String(skillId))
      : [];

    // Fetch step-level mappings (if step provided)
    const stepMappings = stepId
      ? await this.findByTarget('skill_step', stepId)
      : [];

    return {
      agentMappings: agentMappings.filter(
        (m) => m.organizationId.value === organizationId
      ),
      skillMappings: skillMappings.filter(
        (m) => m.organizationId.value === organizationId
      ),
      stepMappings: stepMappings.filter(
        (m) => m.organizationId.value === organizationId
      ),
    };
  }

  // AIDEV-NOTE: Mapping functions - convert between domain and persistence models

  private fromPersistence(record: ContextMappingRow): ContextMapping {
    return {
      id: record.id,
      organizationId: OrganizationId.fromNumber(record.organizationId),
      targetType: record.targetType as ContextMappingTargetType,
      targetId: record.targetId,
      tableId: TableId.fromNumber(record.tableId),
      tableName: record.tableName,
      accessMode: record.accessMode as ContextMapping['accessMode'],
      syncMode: record.syncMode as ContextMapping['syncMode'],
      isSystem: record.isSystem,
      createdAt: record.createdAt!,
      createdBy: record.createdBy ? UserId.fromString(record.createdBy) : undefined,
      updatedAt: record.updatedAt!,
    };
  }
}
