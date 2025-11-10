'use server'

// AIDEV-NOTE: Server Actions for field management using TableApplicationService (consolidated)
// Uses table application service for field operations as part of table aggregate

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { Result, CreateFieldData } from "./types";
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field";
import type { CreateFieldCommand } from "@/ddd/application/services/tables/table-application-service";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { FieldMapper, type FieldDTO } from "@/app/mappers/field-mapper";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger('Fields');

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:create");
    const { tableId, name, type, required = false, relatedTableId, metadata } = data;

    if (!tableId || !name || !type) {
      return {
        success: false,
        error: "tableId, name, and type are required",
      };
    }

    const tableApplicationService = getTableApplicationService();

    const command: CreateFieldCommand = {
      tableId: TableId.fromNumber(tableId),
      name,
      type: type as FieldType,
      required,
      relatedTableId: relatedTableId ? TableId.fromNumber(relatedTableId) : undefined,
      metadata: metadata || {}
    };

    // Log select field creation with options
    if (type === 'single-select' || type === 'multi-select') {
      logger.debug('Creating select field', {
        name,
        type,
        optionCount: metadata?.options?.length || 0,
        hasMetadata: !!metadata
      });
    }

    const result = await tableApplicationService.createField(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create field"
      };
    }

    // Log successful creation with metadata
    if (type === 'single-select' || type === 'multi-select') {
      logger.debug('Select field created successfully', {
        name,
        type,
        savedOptions: result.data?.metadata?.options?.length || 0
      });
    }

    // Initialize autonumber field with currentValue based on existing rows
    if (type === 'autonumber' && result.data) {
      try {
        // Get count of existing rows to set appropriate starting value
        const rows = await tableApplicationService.getRows(
          TableId.fromNumber(tableId),
          {
            limit: 1000, // Get reasonable sample
            offset: 0
          }
        );

        const rowCount = rows.length || 0;
        const startingNumber = (typeof data.metadata?.startingNumber === 'number' ? data.metadata.startingNumber : 1);

        // Set currentValue to max(rowCount, startingNumber) so next value starts after existing rows
        const currentValue = Math.max(rowCount, startingNumber);

        // Update field metadata with currentValue
        await tableApplicationService.updateField({
          tableId: TableId.fromNumber(tableId),
          fieldName: name,
          metadata: {
            ...data.metadata,
            startingNumber,
            currentValue
          }
        });

        logger.debug(`Initialized autonumber field "${name}" with currentValue=${currentValue} (${rowCount} existing rows)`);
      } catch (error) {
        logger.error('Failed to initialize autonumber currentValue:', error);
        // Don't fail the whole operation, field is still created
      }
    }

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }

    return {
      success: true,
      data: result.data ? FieldMapper.toDTO(result.data) : null,
    };
  } catch (error) {
    console.error("Error creating field:", error);
    return {
      success: false,
      error: "Failed to create field",
    };
  }
}

export async function createFieldAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);
  const name = formData.get('name') as string;
  const type = formData.get('type') as FieldType;
  const required = formData.get('required') === 'true';
  const relatedTableId = formData.get('relatedTableId') ? parseInt(formData.get('relatedTableId') as string) : undefined;

  const result = await createField({ tableId, name, type, required, relatedTableId });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main createField function
  return result;
}

export async function getFields(tableId: number): Promise<FieldDTO[]> {
  try {
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(tableId));
    const dtoFields = fieldList.map(FieldMapper.toDTO);

    // Log select fields with their options
    const selectFields = dtoFields.filter(f => f.type === 'single-select' || f.type === 'multi-select');
    if (selectFields.length > 0) {
      logger.debug('Loaded select fields', {
        tableId,
        selectFieldCount: selectFields.length,
        fields: selectFields.map(f => ({
          name: f.name,
          type: f.type,
          optionCount: Array.isArray(f.metadata?.options) ? f.metadata.options.length : 0
        }))
      });
    }

    logger.summary('Loaded fields', { tableId, count: dtoFields.length });

    return dtoFields;
  } catch (error) {
    logger.error("Error fetching fields", error);
    throw new Error("Failed to fetch fields");
  }
}

export async function updateField(data: {
  tableId: number
  fieldName: string
  updates: {
    name?: string
    type?: FieldType
    required?: boolean
    relatedTableId?: number
    metadata?: Record<string, any>
  }
}, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    const { tableId, fieldName, updates } = data;

    if (!tableId || !fieldName) {
      return {
        success: false,
        error: "tableId and fieldName are required",
      };
    }

    const tableApplicationService = getTableApplicationService();

    // Log metadata updates for select fields
    if (updates.metadata?.options) {
      logger.debug('Updating field metadata (options)', {
        fieldName,
        tableId,
        optionCount: updates.metadata.options.length
      });
    }

    const result = await tableApplicationService.updateField({
      tableId: TableId.fromNumber(tableId),
      fieldName,
      name: updates.name,
      type: updates.type,
      required: updates.required,
      metadata: updates.metadata || (updates.relatedTableId ? { relatedTableId: updates.relatedTableId } : undefined)
    });

    if (!result.success) {
      logger.error('Field update failed', { fieldName, error: result.error });
      return {
        success: false,
        error: result.error || "Failed to update field"
      };
    }

    // Log successful update
    if (updates.metadata?.options) {
      logger.debug('Field metadata updated successfully', {
        fieldName,
        savedOptions: result.data?.metadata?.options?.length || 0
      });
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }

    return {
      success: true,
      data: result.data ? FieldMapper.toDTO(result.data) : null,
    };
  } catch (error) {
    console.error("Error updating field:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update field",
    };
  }
}

export async function deleteField(tableId: number, fieldName: string, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    
    if (!tableId || !fieldName) {
      return {
        success: false,
        error: "Table ID and field name are required",
      };
    }

    const tableApplicationService = getTableApplicationService();

    const result = await tableApplicationService.deleteField(TableId.fromNumber(tableId), fieldName);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete field"
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }
    
    return {
      success: true,
      data: { message: "Field deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting field:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete field",
    };
  }
}

// Server action wrapper for deleteField - updated to use correct parameters
export async function deleteFieldAction(formData: FormData): Promise<Result> {
  const fieldId = parseInt(formData.get('fieldId') as string);

  if (!fieldId) {
    return {
      success: false,
      error: "fieldId is required"
    };
  }

  try {
    // We need to find the field by ID to get its name and table
    const session = await requirePermission("data:manage");
    const tableApplicationService = getTableApplicationService();

    // Get all tables to find which table contains this field
    const { getTables } = require('./tables');
    const tables = await getTables();

    let targetTable = null;
    let targetFieldName = null;

    for (const table of tables) {
      const fields = await getFields(table.id);
      const field = fields.find(f => f.id === fieldId);
      if (field) {
        targetTable = table;
        targetFieldName = field.name;
        break;
      }
    }

    if (!targetTable || !targetFieldName) {
      logger.debug('Field not found', { fieldId });
      return {
        success: false,
        error: "Field not found"
      };
    }

    logger.debug('Deleting field', {
      fieldId,
      fieldName: targetFieldName,
      tableId: targetTable.id,
      tableName: targetTable.name
    });

    const result = await deleteField(targetTable.id, targetFieldName);

    if (result.success) {
      logger.summary('Deleted field', { fieldId, fieldName: targetFieldName, tableId: targetTable.id });
    }

    return result;

  } catch (error) {
    logger.error('Error deleting field', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete field"
    };
  }
}
