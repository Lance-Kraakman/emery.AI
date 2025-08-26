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

import type { 
  IFieldRepository 
} from '@/ddd/domain/fields/repositories/field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType
} from '@/ddd/domain/fields/entities/field';

export class DrizzleFieldRepository implements IFieldRepository {
  constructor(
    private readonly db: DbClient,
    private readonly rawClient?: postgres.Sql
  ) {}

  // Basic CRUD
  async findById(id: number): Promise<Field | null> {
    const result = await this.db
      .select()
      .from(fields)
      .where(eq(fields.id, id))
      .limit(1);

    const field = result[0];
    if (!field) return null;

    return this.mapToDomainEntity(field);
  }

  async findByTableId(tableId: number): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(eq(fields.tableId, tableId))
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  async create(data: CreateFieldData): Promise<Field> {
    const [newField] = await this.db
      .insert(fields)
      .values({
        tableId: data.tableId,
        name: data.name,
        slug: data.slug,
        type: data.type,
        orderIndex: data.orderIndex || 0,
        required: data.required || false,
        fieldConfig: data.metadata ? {
          // Map generic metadata to fieldConfig structure
          targetTableId: data.relatedTableId,
          ...data.metadata
        } : (data.relatedTableId ? { targetTableId: data.relatedTableId } : null)
      })
      .returning();

    if (!newField) {
      throw new Error('Failed to create field metadata');
    }

    return this.mapToDomainEntity(newField);
  }

  async update(id: number, data: UpdateFieldData): Promise<Field> {
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
      .where(eq(fields.id, id))
      .returning();

    if (!updatedField) {
      throw new Error(`Field with id ${id} not found or could not be updated`);
    }

    return this.mapToDomainEntity(updatedField);
  }

  async delete(id: number): Promise<void> {
    const result = await this.db
      .delete(fields)
      .where(eq(fields.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error(`Field with id ${id} not found`);
    }
  }

  // Essential business logic
  async checkSlugUniqueness(tableId: number, slug: string, excludeFieldId?: number): Promise<boolean> {
    const result = await this.db
      .select()
      .from(fields)
      .where(and(
        eq(fields.tableId, tableId),
        eq(fields.slug, slug)
      ));

    // Filter out the excluded field if provided
    const filteredResult = excludeFieldId
      ? result.filter(field => field.id !== excludeFieldId)
      : result;

    return filteredResult.length === 0;
  }

  async canDeleteField(fieldId: number): Promise<boolean> {
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
    return {
      id: field.id,
      tableId: field.tableId,
      name: field.name,
      slug: field.slug,
      type: field.type as FieldType,
      orderIndex: field.orderIndex || 0,
      required: field.required || false,
      relatedTableId: field.fieldConfig?.targetTableId || null,
      metadata: field.fieldConfig || null,
      createdAt: field.createdAt!
    };
  }
}