// AIDEV-NOTE: Drizzle implementation of IFieldRepository - handles dynamic table field management
// Manages both field metadata and PostgreSQL column operations for field_{id} naming pattern

import { eq, and, sql, asc, inArray } from 'drizzle-orm';
import type postgres from 'postgres';

import { fields, tables } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IFieldRepository } from '@/lib/domain/repositories/field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType,
  FieldValidation,
  FieldOperation,
  BulkFieldOperation,
  FieldStats,
  FieldQuery,
  LinkToTableValue,
  FileFieldValue,
  LinkToTableConfig,
  FileFieldConfig
} from '@/lib/domain/entities/field';
import type { FileFieldService } from '@/lib/domain/services/file-field-service';
import { FIELD_TYPE_MAPPING, JSONB_FIELD_TYPES, isJsonbField, needsGinIndex } from '@/lib/domain/entities/field';

export class DrizzleFieldRepository implements IFieldRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql,
    private fileFieldService?: FileFieldService
  ) {}

  // Basic Field CRUD operations
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

  async findBySlug(tableId: number, slug: string): Promise<Field | null> {
    const result = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.slug, slug)
        )
      )
      .limit(1);

    const field = result[0];
    if (!field) return null;

    return this.mapToDomainEntity(field);
  }

  async create(data: CreateFieldData): Promise<Field> {
    // Validate field before creation
    const validation = await this.validateField(data);
    if (!validation.isValid) {
      throw new Error(`Invalid field data: ${validation.errors.map(e => e.message).join(', ')}`);
    }

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
    // Get existing field
    const existingField = await this.findById(id);
    if (!existingField) {
      throw new Error(`Field with id ${id} not found`);
    }

    // Update the field metadata
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

    const field = this.mapToDomainEntity(updatedField);

    // If type changed, modify the physical column
    if (data.type && data.type !== existingField.type) {
      await this.modifyFieldInTable(existingField.tableId, id, data.type, data.required);
    }

    // If name changed, rename the physical column
    if (data.name && data.name !== existingField.name) {
      await this.renameFieldInTable(existingField.tableId, id, data.name);
    }

    return field;
  }

  async delete(id: number): Promise<void> {
    // Check if field can be deleted
    const canDelete = await this.canDeleteField(id);
    if (!canDelete) {
      throw new Error(`Cannot delete field ${id} - it has dependencies or data`);
    }

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

  // Physical Schema Operations (PostgreSQL DDL)
  async addFieldToTable(tableId: number, field: Field): Promise<void> {
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

  async removeFieldFromTable(tableId: number, fieldId: number): Promise<void> {
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

  async modifyFieldInTable(tableId: number, fieldId: number, newType: FieldType, newRequired?: boolean): Promise<void> {
    // Get table info
    const [table] = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, tableId))
      .limit(1);

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const sqlType = FIELD_TYPE_MAPPING[newType] || 'TEXT';
    const columnName = `field_${fieldId}`;

    try {
      // Modify column type
      await this.rawClient`
        ALTER TABLE ${this.rawClient(table.dbName)} 
        ALTER COLUMN ${this.rawClient(columnName)} 
        TYPE ${this.rawClient.unsafe(sqlType)} USING ${this.rawClient(columnName)}::${this.rawClient.unsafe(sqlType)}
      `;

      // Modify NOT NULL constraint if specified
      if (newRequired !== undefined) {
        if (newRequired) {
          await this.rawClient`
            ALTER TABLE ${this.rawClient(table.dbName)} 
            ALTER COLUMN ${this.rawClient(columnName)} SET NOT NULL
          `;
        } else {
          await this.rawClient`
            ALTER TABLE ${this.rawClient(table.dbName)} 
            ALTER COLUMN ${this.rawClient(columnName)} DROP NOT NULL
          `;
        }
      }

      // Handle JSONB field indexes
      if (needsGinIndex(newType)) {
        const indexName = `idx_${table.dbName}_${columnName}_gin`;
        await this.rawClient`
          CREATE INDEX IF NOT EXISTS ${this.rawClient(indexName)} 
          ON ${this.rawClient(table.dbName)} USING GIN (${this.rawClient(columnName)})
        `;
      }
    } catch (error) {
      console.error(`Error modifying field ${columnName} in table ${table.dbName}:`, error);
      throw error;
    }
  }

  async renameFieldInTable(tableId: number, fieldId: number, newName: string): Promise<void> {
    // For field_{id} naming pattern, we don't actually rename the column
    // The column name remains field_{id}, only the metadata name changes
    // This is a design choice to maintain consistency
    console.log(`Field ${fieldId} renamed to "${newName}" (metadata only, column name unchanged)`);
  }

  // Field Queries and Discovery
  async findFieldsByType(tableId: number, type: FieldType): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.type, type)
        )
      )
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  async findFieldsByQuery(query: FieldQuery): Promise<Field[]> {
    // Simplified implementation to avoid complex drizzle type issues
    // Start with all fields or filter by table if provided
    let result;
    
    if (query.tableId) {
      result = await this.findByTableId(query.tableId);
    } else {
      const allFields = await this.db.select().from(fields);
      result = allFields.map(field => this.mapToDomainEntity(field));
    }

    // Apply additional filters
    if (query.types && query.types.length > 0) {
      result = result.filter(field => query.types!.includes(field.type as FieldType));
    }
    if (query.required !== undefined) {
      result = result.filter(field => field.required === query.required);
    }

    // Apply ordering
    const orderBy = query.orderBy || 'orderIndex';
    const orderDirection = query.orderDirection || 'ASC';
    
    result.sort((a, b) => {
      let aValue: any, bValue: any;
      
      if (orderBy === 'name') {
        aValue = a.name;
        bValue = b.name;
      } else if (orderBy === 'createdAt') {
        aValue = a.createdAt;
        bValue = b.createdAt;
      } else {
        aValue = a.orderIndex || 0;
        bValue = b.orderIndex || 0;
      }

      if (orderDirection === 'DESC') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    return result.map(field => this.mapToDomainEntity(field));
  }

  async findRequiredFields(tableId: number): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.required, true)
        )
      )
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  async findRelationFields(tableId: number): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.type, 'relation')
        )
      )
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  async getFieldsByOrder(tableId: number): Promise<Field[]> {
    const result = await this.db
      .select()
      .from(fields)
      .where(eq(fields.tableId, tableId))
      .orderBy(asc(fields.orderIndex), asc(fields.id));

    return result.map(field => this.mapToDomainEntity(field));
  }

  // Field Validation and Integrity
  async validateField(field: CreateFieldData | UpdateFieldData): Promise<FieldValidation> {
    const errors: any[] = [];

    // Validate required properties for creation
    if ('tableId' in field && 'name' in field && 'type' in field) {
      const createData = field as CreateFieldData;
      
      if (!createData.name) {
        errors.push({
          type: 'INVALID_NAME',
          message: 'Field name is required',
          field: 'name'
        });
      }

      if (!createData.type) {
        errors.push({
          type: 'INVALID_TYPE',
          message: 'Field type is required',
          field: 'type'
        });
      }

      // Validate relation field has relatedTableId
      if (createData.type === 'relation' && !createData.relatedTableId) {
        errors.push({
          type: 'MISSING_RELATED_TABLE',
          message: 'Relation fields must specify a related table',
          field: 'relatedTableId'
        });
      }

      // Check slug uniqueness
      if (createData.slug) {
        const isUnique = await this.checkSlugUniqueness(createData.tableId, createData.slug);
        if (!isUnique) {
          errors.push({
            type: 'DUPLICATE_SLUG',
            message: 'Field slug must be unique within the table',
            field: 'slug'
          });
        }
      }
    }

    return {
      field: field as Field,
      isValid: errors.length === 0,
      errors
    };
  }

  async validateFieldData(fieldId: number, value: any): Promise<{ valid: boolean; error?: string }> {
    const field = await this.findById(fieldId);
    if (!field) {
      return { valid: false, error: 'Field not found' };
    }

    // Basic type validation
    switch (field.type) {
      case 'number':
        if (value !== null && value !== undefined && isNaN(Number(value))) {
          return { valid: false, error: 'Value must be a number' };
        }
        break;
      
      case 'boolean':
        if (value !== null && value !== undefined && typeof value !== 'boolean') {
          return { valid: false, error: 'Value must be a boolean' };
        }
        break;
      
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return { valid: false, error: 'Value must be a valid email address' };
        }
        break;
      
      case 'url':
        if (value) {
          try {
            new URL(value);
          } catch {
            return { valid: false, error: 'Value must be a valid URL' };
          }
        }
        break;
      
      case 'relation':
        if (value && !Array.isArray(value)) {
          return { valid: false, error: 'Link to table field value must be an array of linked record objects' };
        }
        // Validate Link to Table structure
        if (value && Array.isArray(value)) {
          for (const linkValue of value) {
            if (!linkValue.id || !linkValue.value) {
              return { valid: false, error: 'Each linked record must have id and value properties' };
            }
            // Validate UUID format for linked record IDs
            if (typeof linkValue.id === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkValue.id)) {
              return { valid: false, error: 'Linked record ID must be a valid UUID' };
            }
          }
        }
        break;
        
      case 'file':
        if (value && !Array.isArray(value)) {
          return { valid: false, error: 'File field value must be an array of file objects' };
        }
        // Use FileFieldService for comprehensive file validation
        if (value && Array.isArray(value) && this.fileFieldService) {
          try {
            const validation = await this.fileFieldService.validateFileFieldData(fieldId, value);
            if (!validation.valid) {
              return { valid: false, error: validation.errors.join(', ') };
            }
          } catch (error) {
            return { valid: false, error: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
          }
        } else if (value && Array.isArray(value)) {
          // Fallback validation when FileFieldService not available
          for (const fileValue of value) {
            if (!fileValue.id || !fileValue.name || !fileValue.mimeType || !fileValue.s3Key) {
              return { valid: false, error: 'Each file must have id, name, mimeType, and s3Key properties' };
            }
            // Validate file size is reasonable
            if (fileValue.size && fileValue.size > (parseInt(process.env.MAX_FILE_SIZE || '5242880'))) {
              return { valid: false, error: `File size exceeds maximum allowed size (${process.env.MAX_FILE_SIZE || '5MB'})` };
            }
          }
        }
        break;
    }

    // Check required constraint
    if (field.required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: 'Field is required' };
    }

    return { valid: true };
  }

  async validateBulkFields(fieldsData: (CreateFieldData | UpdateFieldData)[]): Promise<FieldValidation[]> {
    const validations: FieldValidation[] = [];
    
    for (const fieldData of fieldsData) {
      const validation = await this.validateField(fieldData);
      validations.push(validation);
    }

    return validations;
  }

  async checkSlugUniqueness(tableId: number, slug: string, excludeFieldId?: number): Promise<boolean> {
    // Get all fields for the table with the same slug
    const result = await this.db
      .select()
      .from(fields)
      .where(
        and(
          eq(fields.tableId, tableId),
          eq(fields.slug, slug)
        )
      );

    // Filter out the excluded field if provided
    const filteredResult = excludeFieldId 
      ? result.filter(field => field.id !== excludeFieldId)
      : result;

    return filteredResult.length === 0;
  }

  // Field Statistics and Analysis
  async getFieldStats(fieldId: number): Promise<FieldStats> {
    const field = await this.findById(fieldId);
    if (!field) {
      throw new Error(`Field with id ${fieldId} not found`);
    }

    // Get table info
    const [table] = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, field.tableId))
      .limit(1);

    if (!table) {
      throw new Error(`Table with id ${field.tableId} not found`);
    }

    const columnName = `field_${fieldId}`;

    try {
      const result = await this.rawClient`
        SELECT 
          COUNT(*) as total_count,
          COUNT(${this.rawClient(columnName)}) as value_count,
          COUNT(DISTINCT ${this.rawClient(columnName)}) as unique_count
        FROM ${this.rawClient(table.dbName)}
      `;

      const stats = result[0];

      return {
        field,
        valueCount: parseInt(stats.value_count),
        uniqueCount: parseInt(stats.unique_count),
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`Error getting stats for field ${fieldId}:`, error);
      throw error;
    }
  }

  async analyzeFieldUsage(fieldId: number): Promise<any> {
    // TODO: Implement field usage analysis
    return {
      nullCount: 0,
      uniqueCount: 0,
      topValues: []
    };
  }

  // Bulk Field Operations
  async createMultipleFields(fieldsData: CreateFieldData[]): Promise<Field[]> {
    const createdFields: Field[] = [];
    
    for (const fieldData of fieldsData) {
      const field = await this.create(fieldData);
      createdFields.push(field);
    }

    return createdFields;
  }

  async updateMultipleFields(updates: Array<{ id: number; data: UpdateFieldData }>): Promise<Field[]> {
    const updatedFields: Field[] = [];
    
    for (const update of updates) {
      const field = await this.update(update.id, update.data);
      updatedFields.push(field);
    }

    return updatedFields;
  }

  async deleteMultipleFields(fieldIds: number[]): Promise<void> {
    for (const fieldId of fieldIds) {
      await this.delete(fieldId);
    }
  }

  async executeBulkOperation(operation: BulkFieldOperation): Promise<Field[]> {
    if (operation.validateOnly) {
      // Only validate, don't execute
      const validations = await this.validateBulkFields(
        operation.operations.map(op => op.newField!).filter(Boolean)
      );
      
      const hasErrors = validations.some(v => !v.isValid);
      if (hasErrors) {
        throw new Error('Bulk operation validation failed');
      }
      
      return [];
    }

    const results: Field[] = [];

    for (const op of operation.operations) {
      switch (op.type) {
        case 'ADD_FIELD':
          if (op.newField) {
            const field = await this.create(op.newField as CreateFieldData);
            results.push(field);
          }
          break;
        
        case 'REMOVE_FIELD':
          if (op.fieldId) {
            await this.delete(op.fieldId);
          }
          break;
        
        case 'MODIFY_FIELD':
          if (op.fieldId && op.newField) {
            const field = await this.update(op.fieldId, op.newField as UpdateFieldData);
            results.push(field);
          }
          break;
      }
    }

    return results;
  }

  // Field Reordering and Organization
  async reorderFields(tableId: number, fieldOrders: Array<{ fieldId: number; orderIndex: number }>): Promise<Field[]> {
    const updatedFields: Field[] = [];

    for (const { fieldId, orderIndex } of fieldOrders) {
      const field = await this.update(fieldId, { orderIndex });
      updatedFields.push(field);
    }

    return updatedFields;
  }

  async moveFieldToPosition(fieldId: number, newOrderIndex: number): Promise<Field> {
    return await this.update(fieldId, { orderIndex: newOrderIndex });
  }

  async swapFieldPositions(fieldId1: number, fieldId2: number): Promise<Field[]> {
    const field1 = await this.findById(fieldId1);
    const field2 = await this.findById(fieldId2);

    if (!field1 || !field2) {
      throw new Error('One or both fields not found');
    }

    const updatedField1 = await this.update(fieldId1, { orderIndex: field2.orderIndex || 0 });
    const updatedField2 = await this.update(fieldId2, { orderIndex: field1.orderIndex || 0 });

    return [updatedField1, updatedField2];
  }

  // Business Logic Operations
  async canDeleteField(fieldId: number): Promise<boolean> {
    try {
      const field = await this.findById(fieldId);
      if (!field) return false;

      // Check if field is required
      if (field.required) {
        // Required fields need special handling
        const stats = await this.getFieldStats(fieldId);
        if (stats.valueCount > 0) {
          return false; // Has data and is required
        }
      }

      // Could add more checks here (e.g., system fields, references)
      return true;
    } catch (error) {
      return false;
    }
  }

  async getFieldDependencies(fieldId: number): Promise<any> {
    // TODO: Implement dependency analysis
    return {
      relatedFields: [],
      dependentRecords: 0,
      systemReferences: []
    };
  }

  // Placeholder implementations for remaining methods
  async analyzeFieldPerformance(fieldId: number): Promise<any> {
    throw new Error('Field performance analysis not yet implemented');
  }

  async optimizeFieldIndexes(fieldId: number): Promise<void> {
    throw new Error('Field index optimization not yet implemented');
  }

  async rebuildFieldIndexes(fieldId: number): Promise<void> {
    throw new Error('Field index rebuilding not yet implemented');
  }

  async addFieldConstraint(fieldId: number, constraint: any): Promise<void> {
    throw new Error('Field constraints not yet implemented');
  }

  async removeFieldConstraint(fieldId: number, constraintName: string): Promise<void> {
    throw new Error('Field constraints not yet implemented');
  }

  async getFieldConstraints(fieldId: number): Promise<any[]> {
    throw new Error('Field constraints not yet implemented');
  }

  async findDuplicateValues(fieldId: number): Promise<any[]> {
    throw new Error('Duplicate value analysis not yet implemented');
  }

  async cleanupFieldData(fieldId: number, options: any): Promise<any> {
    throw new Error('Field data cleanup not yet implemented');
  }

  async cloneField(sourceFieldId: number, targetTableId: number, newName?: string): Promise<Field> {
    throw new Error('Field cloning not yet implemented');
  }

  async compareFields(fieldId1: number, fieldId2: number): Promise<any> {
    throw new Error('Field comparison not yet implemented');
  }

  async watchFieldChanges(fieldId: number, callback: any): Promise<() => void> {
    throw new Error('Field watching not yet implemented');
  }

  // Baserow-style Link to Table relation field methods
  async createRelationField(data: any): Promise<Field> {
    // Validate that related table exists
    if (!data.config?.relatedTableId) {
      throw new Error('Link to table field requires relatedTableId in config');
    }
    
    const relatedTableExists = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, data.config.relatedTableId))
      .limit(1);
    
    if (relatedTableExists.length === 0) {
      throw new Error(`Related table with id ${data.config.relatedTableId} not found`);
    }

    // Create the relation field
    const fieldData: CreateFieldData = {
      ...data,
      type: 'relation',
      relatedTableId: data.config.relatedTableId,
    };

    const relationField = await this.create(fieldData);

    // TODO: Create reverse field if config.createReverseField is true
    // This would match Baserow's bidirectional relationship behavior

    return relationField;
  }

  async updateRelationConfig(fieldId: number, config: any): Promise<Field> {
    const existingField = await this.findById(fieldId);
    if (!existingField || existingField.type !== 'relation') {
      throw new Error(`Relation field with id ${fieldId} not found`);
    }

    // Update the related table ID if provided
    if (config.relatedTableId) {
      return await this.update(fieldId, { relatedTableId: config.relatedTableId });
    }

    return existingField;
  }

  async getRelationConfig(fieldId: number): Promise<any> {
    const field = await this.findById(fieldId);
    if (!field || field.type !== 'relation') {
      return null;
    }

    return {
      relatedTableId: field.relatedTableId,
      allowMultiple: true, // Default for Baserow-style relations
      createReverseField: false,
    };
  }

  async getRelatedTableFields(fieldId: number): Promise<Field[]> {
    const field = await this.findById(fieldId);
    if (!field || field.type !== 'relation' || !field.relatedTableId) {
      return [];
    }

    return await this.findByTableId(field.relatedTableId);
  }

  async validateRelationIntegrity(fieldId: number): Promise<any> {
    const field = await this.findById(fieldId);
    if (!field || field.type !== 'relation' || !field.relatedTableId) {
      return { valid: false, orphanedRecords: 0, issues: ['Field is not a relation field'] };
    }

    try {
      // Get the table info
      const table = await this.db
        .select()
        .from(tables)
        .where(eq(tables.id, field.tableId))
        .limit(1);

      if (!table[0]) {
        return { valid: false, orphanedRecords: 0, issues: ['Parent table not found'] };
      }

      // TODO: Check for orphaned relation records in the JSONB column
      // This would require parsing the field_${fieldId} column and validating each linked record
      
      return {
        valid: true,
        orphanedRecords: 0,
        issues: []
      };
    } catch (error) {
      return {
        valid: false,
        orphanedRecords: 0,
        issues: [`Validation error: ${error}`]
      };
    }
  }

  // File field methods using FileFieldService
  async createFileField(data: CreateFieldData & { config: FileFieldConfig }): Promise<Field> {
    if (!this.fileFieldService) {
      throw new Error('FileFieldService not available - cannot create file field');
    }

    const fieldData: CreateFieldData & { type: 'file' } = {
      ...data,
      type: 'file',
    };

    return await this.fileFieldService.createFileField(fieldData, data.config);
  }

  async updateFileConfig(fieldId: number, config: FileFieldConfig): Promise<Field> {
    if (!this.fileFieldService) {
      throw new Error('FileFieldService not available - cannot update file field config');
    }

    return await this.fileFieldService.updateFileFieldConfig(fieldId, config);
  }

  async getFileConfig(fieldId: number): Promise<FileFieldConfig | null> {
    const field = await this.findById(fieldId);
    if (!field || field.type !== 'file') {
      return null;
    }

    // Return default file configuration - in production this would be stored in field metadata
    return {
      allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || ['image/*', 'application/pdf', 'text/*'],
      maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
      maxFiles: 10, // Default max files per field
      generateThumbnails: true,
      thumbnailSizes: ['small', 'medium', 'large'],
    };
  }

  async cleanupOrphanedFiles(fieldId: number): Promise<{
    deletedCount: number;
    freedBytes: number;
  }> {
    if (!this.fileFieldService) {
      return {
        deletedCount: 0,
        freedBytes: 0
      };
    }

    // Get field info to determine organization
    const field = await this.findById(fieldId);
    if (!field || field.type !== 'file') {
      throw new Error(`Field ${fieldId} is not a file field`);
    }

    // Get table to find organization
    const table = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, field.tableId))
      .limit(1);

    if (!table[0]) {
      throw new Error(`Table not found for field ${fieldId}`);
    }

    // Use the file field service for cleanup
    const result = await this.fileFieldService.cleanupOrphanedFiles(table[0].organizationId);
    
    return {
      deletedCount: result.deletedFiles,
      freedBytes: result.freedBytes
    };
  }

  // Migration, templates, and groups (placeholder implementations)
  async migrateFieldType(fieldId: number, newType: any, transformFunction?: string): Promise<any> {
    throw new Error('Field migration not yet implemented');
  }

  async getFieldMigrationHistory(fieldId: number): Promise<any[]> {
    throw new Error('Migration history not yet implemented');
  }

  async rollbackFieldMigration(migrationId: string): Promise<Field> {
    throw new Error('Migration rollback not yet implemented');
  }

  async previewFieldMigration(fieldId: number, newType: any): Promise<any> {
    throw new Error('Migration preview not yet implemented');
  }

  async getFieldTemplates(): Promise<any[]> {
    throw new Error('Field templates not yet implemented');
  }

  async createFieldFromTemplate(tableId: number, templateName: string, customData?: any): Promise<Field> {
    throw new Error('Template creation not yet implemented');
  }

  async saveFieldAsTemplate(fieldId: number, templateName: string, description?: string): Promise<any> {
    throw new Error('Template saving not yet implemented');
  }

  async createFieldGroup(data: any): Promise<any> {
    throw new Error('Field groups not yet implemented');
  }

  async updateFieldGroup(groupId: number, data: any): Promise<any> {
    throw new Error('Field groups not yet implemented');
  }

  async deleteFieldGroup(groupId: number): Promise<void> {
    throw new Error('Field groups not yet implemented');
  }

  async getFieldGroups(tableId: number): Promise<any[]> {
    throw new Error('Field groups not yet implemented');
  }

  async addFieldsToGroup(groupId: number, fieldIds: number[]): Promise<any> {
    throw new Error('Field groups not yet implemented');
  }

  async removeFieldsFromGroup(groupId: number, fieldIds: number[]): Promise<any> {
    throw new Error('Field groups not yet implemented');
  }

  // Helper methods
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