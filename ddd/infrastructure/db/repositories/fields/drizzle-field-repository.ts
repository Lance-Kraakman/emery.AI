/**
 * Drizzle Field Repository Implementation
 * 
 * Simplified Drizzle implementation of IFieldRepository for S3/Arrow architecture.
 * Only handles field metadata operations (PostgreSQL fields table).
 * Physical schema operations are handled by FieldSchemaService and TableDataService.
 * 
 * AIDEV-NOTE: Recreated from dist/ version but simplified for S3/Arrow storage - 
 * no physical table operations, just metadata CRUD
 */

import { eq, and, asc } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import type postgres from 'postgres';
import { fields } from '@/lib/db/schema';
import { FieldMapper } from '@/ddd/infrastructure/fields/field-mapper';

import type { 
  IFieldRepository 
} from '@/ddd/domain/fields/repositories/field-repository';
import { 
  Field
} from '@/ddd/domain/fields/entities/field';
import type { 
  CreateFieldData, 
  UpdateFieldData,
  FieldType
} from '@/ddd/domain/fields/entities/field';
import { FieldId, TableId } from '@/ddd/domain/shared/value-objects';

export class DrizzleFieldRepository implements IFieldRepository {
  private readonly fieldMapper = new FieldMapper();

  constructor(
    private readonly db: DbClient,
    private readonly rawClient?: postgres.Sql
  ) {}

  // Basic CRUD
  async findById(id: FieldId): Promise<Field | null> {
    const result = await this.db
      .select()
      .from(fields)
      .where(eq(fields.id, id.value))
      .limit(1);

    const field = result[0];
    if (!field) return null;

    return this.mapToDomainEntity(field);
  }

  async findByTableId(tableId: TableId): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(eq(fields.tableId, tableId.value))
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  async create(data: CreateFieldData): Promise<Field> {
    // Use FieldMapper to get database-specific information
    const tempField = Field.fromPersistence({
      id: 0, // temporary
      tableId: data.tableId.value,
      name: data.name,
      slug: data.slug,
      type: data.type,
      orderIndex: data.orderIndex || 0,
      required: data.required || false,
      relatedTableId: data.relatedTableId?.value || null,
      metadata: data.metadata || null,
      createdAt: new Date()
    });

    const dbMapping = this.fieldMapper.getDatabaseMapping(tempField);

    const [newField] = await this.db
      .insert(fields)
      .values({
        tableId: data.tableId.value,
        name: data.name,
        slug: data.slug,
        type: data.type,
        orderIndex: data.orderIndex || 0,
        required: data.required || false,
        fieldConfig: data.metadata ? {
          // Map generic metadata to fieldConfig structure
          targetTableId: data.relatedTableId?.value,
          postgresType: dbMapping.postgresType,
          requiresIndex: dbMapping.requiresIndex,
          ...data.metadata
        } : (data.relatedTableId ? { 
          targetTableId: data.relatedTableId.value,
          postgresType: dbMapping.postgresType,
          requiresIndex: dbMapping.requiresIndex
        } : {
          postgresType: dbMapping.postgresType,
          requiresIndex: dbMapping.requiresIndex
        })
      })
      .returning();

    if (!newField) {
      throw new Error('Failed to create field metadata');
    }

    return this.mapToDomainEntity(newField);
  }

  async update(id: FieldId, data: UpdateFieldData): Promise<Field> {
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.orderIndex !== undefined) updateData.orderIndex = data.orderIndex;
    if (data.required !== undefined) updateData.required = data.required;
    
    // Handle metadata updates
    if (data.metadata !== undefined) {
      updateData.fieldConfig = data.metadata;
    }
    if (data.relatedTableId !== undefined) {
      updateData.fieldConfig = { 
        ...updateData.fieldConfig, 
        targetTableId: data.relatedTableId 
      };
    }

    const [updatedField] = await this.db
      .update(fields)
      .set(updateData)
      .where(eq(fields.id, id.value))
      .returning();

    if (!updatedField) {
      throw new Error(`Field with id ${id.value} not found or could not be updated`);
    }

    return this.mapToDomainEntity(updatedField);
  }

  async delete(id: FieldId): Promise<void> {
    const result = await this.db
      .delete(fields)
      .where(eq(fields.id, id.value))
      .returning();

    if (result.length === 0) {
      throw new Error(`Field with id ${id.value} not found`);
    }
  }

  // Essential business logic
  async checkSlugUniqueness(tableId: TableId, slug: string, excludeFieldId?: FieldId): Promise<boolean> {
    const result = await this.db
      .select()
      .from(fields)
      .where(and(
        eq(fields.tableId, tableId.value),
        eq(fields.slug, slug)
      ));

    // Filter out the excluded field if provided
    const filteredResult = excludeFieldId
      ? result.filter(field => field.id !== excludeFieldId.value)
      : result;

    return filteredResult.length === 0;
  }

  async canDeleteField(fieldId: FieldId): Promise<boolean> {
    try {
      const field = await this.findById(fieldId);
      if (!field) return false;

      // For S3/Arrow architecture, field deletion is always safe at metadata level
      // Physical schema constraints are handled by FieldSchemaService
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper method to convert from database to domain entity
  private mapToDomainEntity(field: any): Field {
    return Field.fromPersistence({
      id: field.id,
      tableId: field.tableId,
      name: field.name,
      slug: field.slug,
      type: this.fieldMapper.validateFieldType(field.type),
      orderIndex: field.orderIndex || 0,
      required: field.required || false,
      relatedTableId: field.fieldConfig?.targetTableId || null,
      metadata: field.fieldConfig || null,
      createdAt: field.createdAt!
    });
  }

  /**
   * Get database mapping information for a field (used by other infrastructure services)
   */
  getFieldDatabaseMapping(field: Field) {
    return this.fieldMapper.getDatabaseMapping(field);
  }

  /**
   * Get column name for a field ID (used by other infrastructure services)
   */
  getColumnName(fieldId: FieldId): string {
    return this.fieldMapper.getColumnName(fieldId);
  }
}