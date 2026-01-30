'use server'

// AIDEV-NOTE: Server Actions for field management using TableApplicationService (consolidated)
// Uses table application service for field operations as part of table aggregate

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission, getSessionSafe } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTableApplicationService, getRowApplicationService, getViewApplicationService, getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import type { Result, CreateFieldData } from "./types";
import type { FieldType, AutonumberFieldConfig } from "@/ddd/domain/tables/value-objects/table-field";
import type { CreateFieldCommand } from "@/ddd/application/services/tables/table-application-service";
import { TableId } from "@/ddd/domain/shared/value-objects";
import { FieldMapper, type FieldDTO } from "@/app/mappers/field-mapper";
import { createDebugLogger } from "@/lib/utils/debug-logger";
import { normalizeSelectMetadata } from "@/lib/utils/normalize-select-metadata";

const logger = createDebugLogger('Fields');

export async function createField(data: CreateFieldData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("database:create");
    const currentOrg = await requireCurrentOrganization();
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
      metadata: normalizeSelectMetadata(type, metadata || {})
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
        const rowApplicationService = getRowApplicationService();
        const rows = await rowApplicationService.getRows(
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

    // AUDIT: Log field creation
    if (result.data) {
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'field_crud',
          eventAction: 'create',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'field',
          resourceId: String(result.data.id),
          resourceName: result.data.name,
          parentResourceType: 'table',
          parentResourceId: String(tableId),
          eventData: { type, required, relatedTableId },
          success: true,
        }
      );
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

/**
 * Get fields for a table
 *
 * AIDEV-NOTE: Supports public access via view context with auth-first pattern.
 * - If authenticated: use normal RLS-wrapped path with permission check
 * - If unauthenticated with viaViewId: check if view is public, use view schema if so
 * - If unauthenticated without viaViewId: throw auth error
 *
 * @param tableId - Table ID to get fields for
 * @param options - Optional options
 * @param options.viaViewId - View ID that provides context for public access
 */
export async function getFields(
  tableId: number,
  options?: { viaViewId?: number }
): Promise<FieldDTO[]> {
  try {
    if (!tableId) {
      throw new Error("tableId is required");
    }

    const session = await getSessionSafe();

    if (session) {
      // Authenticated user: use normal RLS-wrapped path
      await requireResourcePermission("database:view", "table", tableId);

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

      // Prepend id system field
      const idField: FieldDTO = {
        id: 0,
        name: 'id',
        type: 'number',
        required: true,
        metadata: {},
        orderIndex: -1,
        createdAt: null,
      };

      logger.summary('Loaded fields', { tableId, count: dtoFields.length + 1 });
      return [idField, ...dtoFields];
    } else {
      // Unauthenticated: only allow via public view
      if (!options?.viaViewId) {
        throw new Error("Authentication required to access fields");
      }

      // Get schema via ViewApplicationService.getPublicViewSchema (uses rawDb, bypasses RLS)
      const { ViewId } = await import("@/ddd/domain/views/value-objects/view-id");
      const viewService = getViewApplicationService();
      const schemaResult = await viewService.getPublicViewSchema(ViewId.fromNumber(options.viaViewId));

      if (!schemaResult.success || !schemaResult.data) {
        throw new Error("View not found or not public");
      }

      const dtoFields = schemaResult.data.map(FieldMapper.toDTO);

      // Prepend id system field
      const idField: FieldDTO = {
        id: 0,
        name: 'id',
        type: 'number',
        required: true,
        metadata: {},
        orderIndex: -1,
        createdAt: null,
      };

      logger.summary('Loaded fields (public view)', { tableId, viewId: options.viaViewId, count: dtoFields.length + 1 });
      return [idField, ...dtoFields];
    }
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
    logger.debug('[updateField] Called', { tableId: data.tableId, fieldName: data.fieldName, updates: data.updates });

    const { tableId, fieldName, updates } = data;

    if (!tableId || !fieldName) {
      logger.error('[updateField] Validation failed: missing tableId or fieldName');
      return {
        success: false,
        error: "tableId and fieldName are required",
      };
    }

    // Fields inherit permissions from their parent table
    const session = await requireResourcePermission("database:manage", "table", tableId);
    const currentOrg = await requireCurrentOrganization();
    logger.debug('[updateField] Permission check passed');

    const tableApplicationService = getTableApplicationService();
    logger.debug('[updateField] Calling tableApplicationService.updateField');

    // Log metadata updates for select fields
    if (updates.metadata?.options) {
      logger.debug('Updating field metadata (options)', {
        fieldName,
        tableId,
        optionCount: updates.metadata.options.length
      });
    }

    // Normalize select options if metadata contains options and field is a select type
    const isSelectType = updates.type === 'single-select' || updates.type === 'multi-select';
    const normalizedMetadata = isSelectType && updates.metadata?.options
      ? normalizeSelectMetadata(updates.type!, updates.metadata)
      : updates.metadata;

    const result = await tableApplicationService.updateField({
      tableId: TableId.fromNumber(tableId),
      fieldName,
      name: updates.name,
      type: updates.type,
      required: updates.required,
      metadata: normalizedMetadata || (updates.relatedTableId ? { relatedTableId: updates.relatedTableId } : undefined)
    });

    if (!result.success) {
      logger.error('[updateField] tableApplicationService.updateField failed', { fieldName, error: result.error });
      return {
        success: false,
        error: result.error || "Failed to update field"
      };
    }

    logger.debug('[updateField] tableApplicationService.updateField succeeded');

    // Log successful update
    if (updates.metadata?.options) {
      logger.debug('Field metadata updated successfully', {
        fieldName,
        savedOptions: result.data?.metadata?.options?.length || 0
      });
    }

    // AUDIT: Log field update
    if (result.data) {
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'field_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'field',
          resourceId: String(result.data.id),
          resourceName: result.data.name,
          parentResourceType: 'table',
          parentResourceId: String(tableId),
          eventData: { updates },
          success: true,
        }
      );
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }

    logger.debug('[updateField] Completed successfully', { fieldName });
    return {
      success: true,
      data: result.data ? FieldMapper.toDTO(result.data) : null,
    };
  } catch (error) {
    logger.error("[updateField] Exception caught", error);
    console.error("Error updating field:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update field",
    };
  }
}

export async function deleteField(tableId: number, fieldName: string, revalidateUrl?: string): Promise<Result> {
  try {
    logger.debug('[deleteField] Called', { tableId, fieldName });

    if (!tableId || !fieldName) {
      logger.error('[deleteField] Validation failed: missing tableId or fieldName');
      return {
        success: false,
        error: "Table ID and field name are required",
      };
    }

    // Fields inherit permissions from their parent table
    const session = await requireResourcePermission("database:manage", "table", tableId);
    const currentOrg = await requireCurrentOrganization();
    logger.debug('[deleteField] Permission check passed');

    const tableApplicationService = getTableApplicationService();
    logger.debug('[deleteField] Calling tableApplicationService.deleteField');

    const result = await tableApplicationService.deleteField(TableId.fromNumber(tableId), fieldName);

    if (!result.success) {
      logger.error('[deleteField] tableApplicationService.deleteField failed', { fieldName, error: result.error });
      return {
        success: false,
        error: result.error || "Failed to delete field"
      };
    }

    logger.debug('[deleteField] tableApplicationService.deleteField succeeded');

    // AUDIT: Log field deletion
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'field_crud',
        eventAction: 'delete',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'field',
        resourceId: fieldName, // Field ID not available after deletion
        resourceName: fieldName,
        parentResourceType: 'table',
        parentResourceId: String(tableId),
        eventData: {},
        success: true,
      }
    );

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }

    logger.debug('[deleteField] Completed successfully', { fieldName });
    return {
      success: true,
      data: { message: "Field deleted successfully" },
    };
  } catch (error) {
    logger.error("[deleteField] Exception caught", error);
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

    // Fields inherit permissions from their parent table
    await requireResourcePermission("database:manage", "table", targetTable.id);

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

export async function reorderFields(data: {
  tableId: number
  fieldOrders: Array<{ fieldName: string; orderIndex: number }>
}, revalidateUrl?: string): Promise<Result> {
  try {
    const { tableId, fieldOrders } = data;

    if (!tableId || !fieldOrders || fieldOrders.length === 0) {
      return {
        success: false,
        error: "tableId and fieldOrders are required",
      };
    }

    // Fields inherit permissions from their parent table
    const session = await requireResourcePermission("database:manage", "table", tableId);
    const currentOrg = await requireCurrentOrganization();

    // Filter out system 'id' field - it's a synthetic field not stored in DB
    const filteredFieldOrders = fieldOrders.filter(fo => fo.fieldName !== 'id');

    const tableApplicationService = getTableApplicationService();

    logger.debug('Reordering fields', { tableId, fieldCount: filteredFieldOrders.length });

    const result = await tableApplicationService.reorderFields({
      tableId: TableId.fromNumber(tableId),
      fieldOrders: filteredFieldOrders
    });

    if (!result.success) {
      logger.error('Field reordering failed', { tableId, error: result.error });
      return {
        success: false,
        error: result.error || "Failed to reorder fields"
      };
    }

    logger.summary('Fields reordered successfully', { tableId, fieldCount: fieldOrders.length });

    // AUDIT: Log field reorder
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'field_crud',
        eventAction: 'update',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'field',
        resourceId: String(tableId),
        resourceName: 'field_order',
        parentResourceType: 'table',
        parentResourceId: String(tableId),
        eventData: { action: 'reorder', fieldCount: fieldOrders.length },
        success: true,
      }
    );

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for field operations
    }

    return {
      success: true,
      data: { message: "Fields reordered successfully" },
    };
  } catch (error) {
    console.error("Error reordering fields:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reorder fields",
    };
  }
}

/**
 * Reset autonumber field counter
 * Only affects new rows - existing rows are not changed
 */
export async function resetAutonumberCounter(
  tableId: number,
  fieldName: string,
  resetValue?: number,
  revalidateUrl?: string
): Promise<Result> {
  try {
    // Fields inherit permissions from their parent table
    await requireResourcePermission("database:manage", "table", tableId);

    // Get field and verify it's autonumber
    const fields = await getFields(tableId);
    const field = fields.find(f => f.name === fieldName);

    if (!field || field.type !== 'autonumber') {
      return {
        success: false,
        error: "Field not found or not an autonumber field",
      };
    }

    // Get current metadata and determine reset value
    const currentMetadata = (field.metadata as AutonumberFieldConfig) || {};
    const newCurrentValue = resetValue ?? currentMetadata.startingNumber ?? 1;

    // Update field metadata (set to resetValue - 1 so next number is resetValue)
    return await updateField({
      tableId,
      fieldName,
      updates: {
        metadata: {
          ...currentMetadata,
          currentValue: newCurrentValue - 1
        }
      }
    }, revalidateUrl);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset counter",
    };
  }
}

/**
 * Get fields for a view by viewId
 * Used by EditorDataLayoutProvider to fetch fields for field selector in sidebar
 */
export async function getFieldsForView(viewId: number): Promise<FieldDTO[]> {
  try {
    if (!viewId) {
      return [];
    }

    // Import getView to avoid circular dependency
    const { getView } = await import('./views');
    const view = await getView(viewId);

    if (!view) {
      return [];
    }

    return await getFields(view.tableId);
  } catch (error) {
    logger.error('Error getting fields for view', error);
    return [];
  }
}
