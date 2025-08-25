'use server'

// AIDEV-NOTE: Server Actions for field management using FieldApplicationService
// Uses application service for business logic and validation

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getFieldApplicationService } from "@/ddd/application/di/container";
import type { Result, CreateFieldData } from "./types";
import type { Field, FieldType } from "@/ddd/domain/fields/entities/field";
import type { CreateFieldCommand } from "@/ddd/application/services/fields/field-application-service";

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

    const fieldApplicationService = getFieldApplicationService();

    const command: CreateFieldCommand = {
      tableId,
      name,
      type: type as FieldType,
      required,
      relatedTableId,
      metadata: {}
    };

    const result = await fieldApplicationService.createField(command);

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
      data: result.data,
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

export async function getFields(tableId: number): Promise<Field[]> {
  try {
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const fieldApplicationService = getFieldApplicationService();
    const fieldList = await fieldApplicationService.getFieldsForTable(tableId);

    return fieldList;
  } catch (error) {
    console.error("Error fetching fields:", error);
    throw new Error("Failed to fetch fields");
  }
}

export async function deleteField(fieldId: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_fields");
    
    if (!fieldId) {
      return {
        success: false,
        error: "Field ID is required",
      };
    }

    const fieldApplicationService = getFieldApplicationService();

    const result = await fieldApplicationService.deleteField(fieldId);

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

export async function deleteFieldAction(formData: FormData) {
  const fieldId = parseInt(formData.get('fieldId') as string);

  const result = await deleteField(fieldId);
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main deleteField function
  return result;
}
