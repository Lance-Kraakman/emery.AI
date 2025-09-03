'use server'

// AIDEV-NOTE: Server Actions for field management using TableApplicationService (consolidated)
// Uses table application service for field operations as part of table aggregate

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { Result, CreateFieldData } from "./types";
import type { FieldType } from "@/ddd/domain/tables/value-objects/table-field";
import type { CreateFieldCommand } from "@/ddd/application/services/tables/table-application-service";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { FieldMapper, type FieldDTO } from "@/app/mappers/field-mapper";

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("create_fields");
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
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const tableApplicationService = getTableApplicationService();
    const fieldList = await tableApplicationService.getFieldsForTable(TableId.fromNumber(tableId));

    return fieldList.map(FieldMapper.toDTO);
  } catch (error) {
    console.error("Error fetching fields:", error);
    throw new Error("Failed to fetch fields");
  }
}

export async function deleteField(tableId: number, fieldName: string, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_fields");
    
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

// Legacy wrapper for old deleteField signature - DEPRECATED
export async function deleteFieldAction(formData: FormData): Promise<Result> {
  const fieldId = formData.get('fieldId') as string;
  
  // This is deprecated and will fail - frontend components need to be updated
  return {
    success: false,
    error: "deleteFieldAction is deprecated - use deleteField with tableId and fieldName"
  };
}
