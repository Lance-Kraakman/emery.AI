/**
 * Field Application Service
 * 
 * Orchestrates field operations with business logic and validation.
 * Handles field creation, updates, deletion, ordering, and type validation.
 * 
 * AIDEV-NOTE: Application service for field management - coordinates
 * between field and table repositories, manages dynamic column operations
 */

import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { Field, CreateFieldData, UpdateFieldData, FieldType } from '@/ddd/domain/fields/entities/field';
import type { Result } from '@/ddd/domain/shared/result';
import { TableId, FieldId } from '@/ddd/domain/shared/value-objects';
import { slugify } from '@/utils/slugify';

export interface CreateFieldCommand {
  tableId: number;
  name: string;
  type: FieldType;
  required?: boolean;
  relatedTableId?: number;
  metadata?: Record<string, any>;
}

export interface UpdateFieldCommand {
  id: number;
  name?: string;
  required?: boolean;
  orderIndex?: number;
  metadata?: Record<string, any>;
}

export interface ReorderFieldsCommand {
  tableId: number;
  fieldOrders: Array<{ fieldId: number; orderIndex: number }>;
}

// Use unified Result interface from domain shared types
export type FieldApplicationServiceResult<T = any> = Result<T>;

export class FieldApplicationService {
  constructor(
    private readonly fieldRepository: IFieldRepository,
    private readonly dynamicTableService: DynamicTableService
  ) {}

  /**
   * Create a new field for a table
   */
  async createField(command: CreateFieldCommand): Promise<FieldApplicationServiceResult<Field>> {
    try {
      // 1. Verify table exists
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Generate and validate slug
      const slug = slugify(command.name);
      
      // Check if slug is unique for this table
      const isUnique = await this.fieldRepository.checkSlugUniqueness(TableId.fromNumber(command.tableId), slug);
      if (!isUnique) {
        return {
          success: false,
          error: `Field with name "${command.name}" already exists in this table`
        };
      }

      // 3. Validate related table if it's a relation field
      if (command.type === 'relation' && command.relatedTableId) {
        const relatedTable = await this.dynamicTableService.getTable(TableId.fromNumber(command.relatedTableId));
        if (!relatedTable) {
          return {
            success: false,
            error: `Related table ${command.relatedTableId} not found`
          };
        }

        // Ensure related table is in the same organization
        if (relatedTable.organizationId !== table.organizationId) {
          return {
            success: false,
            error: 'Related table must be in the same organization'
          };
        }
      }

      // 4. Get max order index for proper field ordering
      const existingFields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      const orderIndex = existingFields.length > 0 
        ? Math.max(...existingFields.map((f: Field) => f.orderIndex || 0)) + 1 
        : 0;

      // 5. Create field data
      const fieldData: CreateFieldData = {
        tableId: TableId.fromNumber(command.tableId),
        name: command.name,
        slug,
        type: command.type,
        required: command.required || false,
        orderIndex,
        relatedTableId: command.relatedTableId ? TableId.fromNumber(command.relatedTableId) : undefined,
        metadata: command.metadata
      };

      // 6. Create field metadata
      const newField = await this.fieldRepository.create(fieldData);

      // 7. For S3/Arrow storage, field schema operations are handled automatically
      // Fields are added to the schema when data is written to S3
      console.log(`[FIELD-APP-SERVICE] Created field: ${newField.name} (${newField.type}) for table ${table.name}`);

      return {
        success: true,
        data: newField
      };

    } catch (error) {
      console.error('[FIELD-APP-SERVICE] Error creating field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create field'
      };
    }
  }

  /**
   * Update an existing field
   */
  async updateField(command: UpdateFieldCommand): Promise<FieldApplicationServiceResult<Field>> {
    try {
      // 1. Get existing field
      const field = await this.fieldRepository.findById(FieldId.fromNumber(command.id));
      if (!field) {
        return {
          success: false,
          error: `Field ${command.id} not found`
        };
      }

      // 2. Prepare updates
      const updates: UpdateFieldData = {};

      // Handle name change
      if (command.name && command.name !== field.name) {
        const newSlug = slugify(command.name);
        
        // Check if new slug is unique
        const isUnique = await this.fieldRepository.checkSlugUniqueness(field.tableId, newSlug);
        if (!isUnique) {
          return {
            success: false,
            error: `Field with name "${command.name}" already exists in this table`
          };
        }

        updates.name = command.name;
        updates.slug = newSlug;
      }

      // Handle required flag change
      if (command.required !== undefined && command.required !== field.required) {
        // If making field required, check if table has existing rows
        if (command.required) {
          const hasRows = await this.dynamicTableService.hasRows(field.tableId);
          if (hasRows) {
            return {
              success: false,
              error: 'Cannot make field required when table has existing data'
            };
          }
        }
        updates.required = command.required;
      }

      // Handle order index change
      if (command.orderIndex !== undefined) {
        updates.orderIndex = command.orderIndex;
      }

      // Handle metadata change
      if (command.metadata) {
        updates.metadata = {
          ...field.metadata,
          ...command.metadata
        };
      }

      // 3. Update field if there are changes
      if (Object.keys(updates).length > 0) {
        const updatedField = await this.fieldRepository.update(FieldId.fromNumber(command.id), updates);
        
        console.log(`[FIELD-APP-SERVICE] Updated field: ${updatedField.name}`);
        
        return {
          success: true,
          data: updatedField
        };
      }

      return {
        success: true,
        data: field
      };

    } catch (error) {
      console.error('[FIELD-APP-SERVICE] Error updating field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update field'
      };
    }
  }

  /**
   * Delete a field from a table
   */
  async deleteField(fieldId: number): Promise<FieldApplicationServiceResult<void>> {
    try {
      // 1. Verify field exists
      const field = await this.fieldRepository.findById(FieldId.fromNumber(fieldId));
      if (!field) {
        return {
          success: false,
          error: `Field ${fieldId} not found`
        };
      }

      // 2. Check if field can be safely deleted using repository
      const canDelete = await this.fieldRepository.canDeleteField(FieldId.fromNumber(fieldId));
      if (!canDelete) {
        return {
          success: false,
          error: 'Field cannot be deleted'
        };
      }

      // 3. For S3/Arrow storage, field removal is handled automatically
      // Historical data retains the field, new data won't include it

      // 4. Delete the field metadata
      await this.fieldRepository.delete(FieldId.fromNumber(fieldId));

      console.log(`[FIELD-APP-SERVICE] Deleted field: ${field.name} from table ${field.tableId}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[FIELD-APP-SERVICE] Error deleting field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete field'
      };
    }
  }

  /**
   * Reorder fields in a table
   */
  async reorderFields(command: ReorderFieldsCommand): Promise<FieldApplicationServiceResult<Field[]>> {
    try {
      // 1. Verify table exists
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Get all fields for the table
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
      
      // 3. Validate all field IDs in the reorder command exist
      const fieldIds = new Set(fields.map((f: Field) => f.id));
      for (const order of command.fieldOrders) {
        if (!fieldIds.has(FieldId.fromNumber(order.fieldId))) {
          return {
            success: false,
            error: `Field ${FieldId.fromNumber(order.fieldId)} not found in table ${command.tableId}`
          };
        }
      }

      // 4. Update order indices
      const updatedFields: Field[] = [];
      for (const order of command.fieldOrders) {
        const updatedField = await this.fieldRepository.update(FieldId.fromNumber(order.fieldId), {
          orderIndex: order.orderIndex
        });
        updatedFields.push(updatedField);
      }

      console.log(`[FIELD-APP-SERVICE] Reordered ${updatedFields.length} fields in table ${table.name}`);

      return {
        success: true,
        data: updatedFields.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      };

    } catch (error) {
      console.error('[FIELD-APP-SERVICE] Error reordering fields:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reorder fields'
      };
    }
  }

  /**
   * Get field by ID
   */
  async getField(fieldId: number): Promise<Field | null> {
    return await this.fieldRepository.findById(FieldId.fromNumber(fieldId));
  }

  /**
   * Get fields for a table
   */
  async getFieldsForTable(tableId: number): Promise<Field[]> {
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    // Return fields sorted by order index
    return fields.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  /**
   * Validate field value based on field type
   */
  validateFieldValue(field: Field, value: any): { valid: boolean; error?: string } {
    // Handle null/undefined
    if (value === null || value === undefined) {
      if (field.required) {
        return { valid: false, error: `Field "${field.name}" is required` };
      }
      return { valid: true };
    }

    // Type-specific validation
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        if (typeof value !== 'string') {
          return { valid: false, error: `Field "${field.name}" must be a string` };
        }
        
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { valid: false, error: `Field "${field.name}" must be a valid email` };
          }
        }
        
        if (field.type === 'url' && value) {
          try {
            new URL(value);
          } catch {
            return { valid: false, error: `Field "${field.name}" must be a valid URL` };
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: `Field "${field.name}" must be a number` };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `Field "${field.name}" must be a boolean` };
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return { valid: false, error: `Field "${field.name}" must be a valid date` };
        }
        break;

      case 'relation':
        // Relation fields store JSONB data
        if (typeof value !== 'object') {
          return { valid: false, error: `Field "${field.name}" must be an object` };
        }
        break;

      case 'file':
        // File fields store file metadata as JSONB
        if (typeof value !== 'object') {
          return { valid: false, error: `Field "${field.name}" must be a file object` };
        }
        break;

      default:
        return { valid: false, error: `Unknown field type: ${field.type}` };
    }

    return { valid: true };
  }

  /**
   * Batch validate multiple field values
   */
  async validateRowData(tableId: number, data: Record<string, any>): Promise<{
    valid: boolean;
    errors: Array<{ field: string; error: string }>;
  }> {
    const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
    const errors: Array<{ field: string; error: string }> = [];

    for (const field of fields) {
      const value = data[field.slug];
      const validation = this.validateFieldValue(field, value);
      
      if (!validation.valid && validation.error) {
        errors.push({ field: field.slug, error: validation.error });
      }
    }

    // Check for required fields that are missing
    for (const field of fields) {
      if (field.required && !(field.slug in data)) {
        errors.push({ field: field.slug, error: `Field "${field.name}" is required` });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}