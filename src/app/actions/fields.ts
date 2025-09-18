'use server'

// AIDEV-NOTE: Server Actions for field management using TableApplicationService (consolidated)
// Uses table application service for field operations as part of table aggregate

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { withAuthContext } from '@/src/lib/auth/with-context';
import { getTableApplicationService } from "@/src/ddd/application/di/container";
import type { Result, CreateFieldData } from "./types";
import type { FieldType } from "@/src/ddd/domain/tables/value-objects/table-field";
import type { CreateFieldCommand } from "@/src/ddd/application/services/tables/table-application-service";
import { TableId } from "@/src/ddd/domain/shared/value-objects";
import { FieldMapper, type FieldDTO } from "@/src/app/mappers/field-mapper";

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:create");
    const { tableId, name, type, required = false, relatedTableId } = data;

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
      metadata: {}
    };

    const result = await tableApplicationService.createField(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to create field"
      };
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
    console.log('[FIELD-LOADING-DEBUG] getFields called for tableId:', tableId);
    
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(tableId));
    
    console.log('[FIELD-LOADING-DEBUG] Raw fieldList from service:', fieldList.map(f => ({
      id: f.id?.value,
      name: f.name,
      type: f.type,
      required: f.required
    })));

    const dtoFields = fieldList.map(FieldMapper.toDTO);
    
    console.log('[FIELD-LOADING-DEBUG] Mapped DTO fields:', dtoFields.map(f => ({
      id: f.id,
      name: f.name,
      type: f.type,
      required: f.required
    })));

    return dtoFields;
  } catch (error) {
    console.error("[FIELD-LOADING-DEBUG] Error fetching fields:", error);
    throw new Error("Failed to fetch fields");
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
  
  console.log('[FIELD-DELETE-DEBUG] deleteFieldAction called with fieldId:', fieldId);
  
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
      console.log('[FIELD-DELETE-DEBUG] Field not found - fieldId:', fieldId);
      return {
        success: false,
        error: "Field not found"
      };
    }
    
    console.log('[FIELD-DELETE-DEBUG] Found field:', targetFieldName, 'in table:', targetTable.id, targetTable.name);
    
    const result = await deleteField(targetTable.id, targetFieldName);
    console.log('[FIELD-DELETE-DEBUG] Delete result:', result);
    
    return result;
    
  } catch (error) {
    console.error('[FIELD-DELETE-DEBUG] Error deleting field:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete field"
    };
  }
}
