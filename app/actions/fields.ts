'use server'

// AIDEV-NOTE: Server Actions for field management using domain repositories
// Migrated from legacy dynamic.ts to domain-driven architecture

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { getFieldRepository } from "@/ddd/application/di/container";
import { slugify } from "@/utils/slugify";
import type { ActionResult, CreateFieldData } from "./types";
import type { Field, FieldType } from "@/ddd/domain/fields/entities/field";

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("create_fields");
    const { tableId, name, type, required = false, relatedTableId } = data;

    if (!tableId || !name || !type) {
      return {
        success: false,
        error: "tableId, name, and type are required",
      };
    }

    const fieldRepository = getFieldRepository();

    // AIDEV-TODO: Verify table exists and user has permission using DynamicTableRepository

    const fieldData = {
      tableId,
      name,
      slug: slugify(name),
      type: type as FieldType,
      required,
      relatedTableId,
    };

    const newField = await fieldRepository.create(fieldData);

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }
    
    return {
      success: true,
      data: newField,
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

    const fieldRepository = getFieldRepository();
    const fieldList = await fieldRepository.findByTableId(tableId);

    return fieldList;
  } catch (error) {
    console.error("Error fetching fields:", error);
    throw new Error("Failed to fetch fields");
  }
}

export async function deleteField(fieldId: number, revalidateUrl?: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("manage_fields");
    
    if (!fieldId) {
      return {
        success: false,
        error: "Field ID is required",
      };
    }

    const fieldRepository = getFieldRepository();

    // AIDEV-TODO: Verify user has permission to delete field from this table

    await fieldRepository.delete(fieldId);

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
      error: "Failed to delete field",
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
