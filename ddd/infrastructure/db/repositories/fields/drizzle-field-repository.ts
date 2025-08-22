// AIDEV-NOTE: Simplified Drizzle implementation of IFieldRepository
// Only implements the methods actually used in the application

import { eq, and, sql, asc } from 'drizzle-orm';
import type postgres from 'postgres';

import { fields, tables } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType
} from '@/ddd/domain/fields/entities/field';
import type { FileFieldService } from '@/ddd/domain/files/services/file-field-service';
import { FIELD_TYPE_MAPPING, needsGinIndex } from '@/ddd/domain/fields/entities/field';

export class DrizzleFieldRepository implements IFieldRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql,
    private fileFieldService?: FileFieldService
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
    // Create the field metadata
    const [newField] = await this.db
      .insert(fields)
      .values({
        tableId: data.tableId,
        name: data.name,
        slug: data.slug,
        type: data.type,
        orderIndex: data.orderIndex || 0,
        relatedTableId: data.relatedTableId || null,
        required: data.required || false,
      })
      .returning();

    if (!newField) {
      throw new Error('Failed to create field metadata');
    }

    const field = this.mapToDomainEntity(newField);

    // Add the physical column to the table
    try {
      await this.addFieldToTable(data.tableId, field);
    } catch (error) {
      // Rollback metadata creation if physical column creation fails
      await this.db.delete(fields).where(eq(fields.id, newField.id));
      throw new Error(`Failed to create physical field: ${error}`);
    }

    return field;
  }

  async update(id: number, data: UpdateFieldData): Promise<Field> {
    const [updatedField] = await this.db
      .update(fields)
      .set({
        name: data.name,
        slug: data.slug,
        type: data.type,
        orderIndex: data.orderIndex,
        relatedTableId: data.relatedTableId,
        required: data.required,
      })
      .where(eq(fields.id, id))
      .returning();

    if (!updatedField) {
      throw new Error(`Field with id ${id} not found or could not be updated`);
    }

    return this.mapToDomainEntity(updatedField);
  }

  async delete(id: number): Promise<void> {
    // Get field info before deletion
    const field = await this.findById(id);
    if (!field) {
      throw new Error(`Field with id ${id} not found`);
    }

    // Remove the physical column first
    await this.removeFieldFromTable(field.tableId, id);

    // Then delete the metadata
    await this.db.delete(fields).where(eq(fields.id, id));
  }

  // Essential business logic
  async checkSlugUniqueness(tableId: number, slug: string, excludeFieldId?: number): Promise<boolean> {
    let query = this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.slug, slug)
        )
      );

    const result = await query;

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

      // For now, simple check - can delete if field exists
      // Could add more complex logic later if needed
      return true;
    } catch (error) {
      return false;
    }
  }

  // Helper methods for physical field operations
  private async addFieldToTable(tableId: number, field: Field): Promise<void> {
    // Get table info
    const [table] = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const sqlType = FIELD_TYPE_MAPPING[field.type as FieldType] || 'TEXT';
    const nullable = field.required ? 'NOT NULL' : '';
    const columnName = `field_${field.id}`;

    try {
      // Add the column
      await this.rawClient`
        ALTER TABLE ${this.rawClient(table.dbName)} 
        ADD COLUMN ${this.rawClient(columnName)} ${this.rawClient.unsafe(sqlType)} ${this.rawClient.unsafe(nullable)}
      `;

      // Add GIN index for JSONB fields (relations and files)
      if (needsGinIndex(field.type as FieldType)) {
        const indexName = `idx_${table.dbName}_${columnName}_gin`;
        await this.rawClient`
          CREATE INDEX IF NOT EXISTS ${this.rawClient(indexName)} 
          ON ${this.rawClient(table.dbName)} USING GIN (${this.rawClient(columnName)})
        `;
      }
    } catch (error) {
      console.error(`Error adding field ${columnName} to table ${table.dbName}:`, error);
      throw error;
    }
  }

  private async removeFieldFromTable(tableId: number, fieldId: number): Promise<void> {
    // Get table info
    const [table] = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const columnName = `field_${fieldId}`;

    try {
      await this.rawClient`
        ALTER TABLE ${this.rawClient(table.dbName)} 
        DROP COLUMN IF EXISTS ${this.rawClient(columnName)}
      `;
    } catch (error) {
      console.error(`Error removing field ${columnName} from table ${table.dbName}:`, error);
      throw error;
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
      orderIndex: field.orderIndex,
      relatedTableId: field.relatedTableId,
      required: field.required,
      createdAt: field.createdAt,
    };
  }
}