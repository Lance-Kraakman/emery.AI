'use server'

// AIDEV-NOTE: Server Actions for table management using TableApplicationService
// Uses application service for business logic and validation

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTableApplicationService, getRowApplicationService, getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, DatabaseId, UserId } from "@/ddd/domain/shared/value-objects";
import type { Result, CreateTableData } from "./types";
import type { CreateTableCommand, UpdateTableCommand } from "@/ddd/application/services/tables/table-application-service";
import { TableMapper, type TableDTO } from "@/app/mappers/table-mapper";
import { FieldMapper, type FieldDTO } from "@/app/mappers/field-mapper";

// Extended DTO that includes fields - used for template export
export interface TableWithFieldsDTO extends TableDTO {
  fields: FieldDTO[];
}

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

export async function createTable(data: CreateTableData & { databaseId: number; description?: string }, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:create");
      const currentOrg = await requireCurrentOrganization();
      const { name, databaseId, description } = data;

      if (!name) {
        return {
          success: false,
          error: "name is required",
        };
      }

      if (!databaseId) {
        return {
          success: false,
          error: "Database selection is required. Tables must belong to a database.",
        };
      }

      // Use TableApplicationService for table creation
      const tableApplicationService = getTableApplicationService();

      const command: CreateTableCommand = {
        name,
        databaseId: DatabaseId.fromNumber(databaseId),
        organizationId: OrganizationId.fromNumber(currentOrg.id),
        ownerId: UserId.fromString(session.user.id),
        description,
        metadata: {}
      };

      const result = await tableApplicationService.createTable(command);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to create table"
        };
      }

      // AUDIT: Log table creation
      if (result.data) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(currentOrg.id),
          {
            eventType: 'database',
            eventCategory: 'table_crud',
            eventAction: 'create',
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: 'table',
            resourceId: String(result.data.id.value),
            resourceName: result.data.name,
            eventData: { databaseId, description },
            success: true,
          }
        );
      }

      // Note: RAG reindexing is now handled automatically by database triggers

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/data'); // Default path for table operations
      }

      return {
        success: true,
        data: result.data ? TableMapper.toDTO(result.data) : null,
      };
    } catch (error) {
      console.error("Error creating table:", error);
      return {
        success: false,
        error: "Failed to create table",
      };
    }
  });
}

export async function createTableAction(formData: FormData) {
  const name = formData.get('name') as string;
  const databaseId = parseInt(formData.get('databaseId') as string);

  if (!databaseId) {
    throw new Error("Database ID is required");
  }

  const result = await createTable({ name, databaseId });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main createTable function
  return result;
}

export async function getTables(): Promise<TableDTO[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("database:view");
      const currentOrg = await requireCurrentOrganization();
      const tableApplicationService = getTableApplicationService();

      const tableList = await tableApplicationService.getTablesForOrganization(OrganizationId.fromNumber(currentOrg.id));

      console.log(`[GET-TABLES] Found ${tableList.length} tables for org ${currentOrg.id}`);
      return tableList.map(TableMapper.toDTO);
    } catch (error) {
      console.error("Error fetching tables:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');

      // Return empty array instead of throwing error to prevent UI crashes
      console.log(`[GET-TABLES] Returning empty array due to error to prevent UI crash`);
      return [];
    }
  });
}

/**
 * Update an existing table
 */
export async function updateTable(
  tableId: number,
  updates: { name?: string; description?: string; metadata?: Record<string, any> },
  revalidateUrl?: string
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!tableId) {
        return {
          success: false,
          error: "Table ID is required",
        };
      }

      const session = await requireResourcePermission("database:manage", "table", tableId);
      const currentOrg = await requireCurrentOrganization();

      const tableApplicationService = getTableApplicationService();

      const command: UpdateTableCommand = {
        id: TableId.fromNumber(tableId),
        name: updates.name,
        description: updates.description,
        metadata: updates.metadata
      };

      const result = await tableApplicationService.updateTable(command);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to update table"
        };
      }

      // AUDIT: Log table update
      if (result.data) {
        const auditService = getAuditApplicationService();
        auditService.logEvent(
          OrganizationId.fromNumber(currentOrg.id),
          {
            eventType: 'database',
            eventCategory: 'table_crud',
            eventAction: 'update',
            actorType: 'user',
            actorId: session.user.id,
            actorName: session.user.name || undefined,
            resourceType: 'table',
            resourceId: String(tableId),
            resourceName: result.data.name,
            eventData: { updates },
            success: true,
          }
        );
      }

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/data'); // Default path for table operations
      }

      return {
        success: true,
        data: result.data ? TableMapper.toDTO(result.data) : null,
      };
    } catch (error) {
      console.error("Error updating table:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update table",
      };
    }
  });
}

export async function deleteTable(tableId: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!tableId) {
        return {
          success: false,
          error: "Table ID is required",
        };
      }

      const session = await requireResourcePermission("database:manage", "table", tableId);
      const currentOrg = await requireCurrentOrganization();

      const tableApplicationService = getTableApplicationService();

      // AUDIT: Get table name BEFORE deletion
      const tableToDelete = await tableApplicationService.getTable(TableId.fromNumber(tableId));
      const tableName = tableToDelete?.name;

      const result = await tableApplicationService.deleteTable(TableId.fromNumber(tableId));

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to delete table"
        };
      }

      // AUDIT: Log table deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'database',
          eventCategory: 'table_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'table',
          resourceId: String(tableId),
          resourceName: tableName,
          eventData: {},
          success: true,
        }
      );

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/data'); // Default path for table operations
      }

      return {
        success: true,
        data: { message: "Table deleted successfully" },
      };
    } catch (error) {
      console.error("Error deleting table:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete table",
      };
    }
  });
}

export async function deleteTableAction(formData: FormData) {
  const tableId = parseInt(formData.get('tableId') as string);

  const result = await deleteTable(tableId);

  if (!result.success) {
    throw new Error(result.error);
  }

  // Note: revalidatePath is handled in the main deleteTable function
  return result;
}

/**
 * Duplicate an existing table
 * Appends " (Copy)" to the table name and copies the schema
 */
export async function duplicateTable(tableId: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!tableId) {
        return {
          success: false,
          error: "Table ID is required",
        };
      }

      // Need to view the original table to duplicate it
      await requireResourcePermission("database:view", "table", tableId);
      // Need create permission for the new table
      const session = await requirePermission("database:create");
      const currentOrg = await requireCurrentOrganization();

    const tableApplicationService = getTableApplicationService();

    // Get the original table
    const originalTable = await tableApplicationService.getTable(TableId.fromNumber(tableId));
    if (!originalTable) {
      return { success: false, error: "Table not found" };
    }

    // Create new name with " (Copy)" suffix
    const newName = `${originalTable.name} (Copy)`;

    // Create the duplicate table
    const command: CreateTableCommand = {
      name: newName,
      databaseId: originalTable.databaseId,
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      ownerId: UserId.fromString(session.user.id),
      description: originalTable.description,
      metadata: originalTable.metadata || {}
    };

    const result = await tableApplicationService.createTable(command);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to duplicate table"
      };
    }

    // AUDIT: Log table duplication
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'table_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'table',
        resourceId: String(result.data.id.value),
        resourceName: result.data.name,
        eventData: { duplicatedFrom: tableId, originalName: originalTable.name },
        success: true,
      }
    );

    // TODO: Copy fields from original table to new table
    // This would require additional logic to duplicate the table schema

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data');
    }

      return {
        success: true,
        data: TableMapper.toDTO(result.data),
      };
    } catch (error) {
      console.error("Error duplicating table:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to duplicate table",
      };
    }
  });
}

/**
 * Search for rows in a table for relation field selection
 */
export async function searchTableRows(tableId: number, query: string, limit: number = 20): Promise<Result> {
  return withAuthContext(async () => {
    try {
      console.log('[searchTableRows] Starting search:', { tableId, query, limit });

      if (!tableId) {
        console.error('[searchTableRows] No tableId provided');
        return {
          success: false,
          error: "tableId is required",
        };
      }

      await requireResourcePermission("database:view", "table", tableId);
      const currentOrg = await requireCurrentOrganization();

    // Use RowApplicationService for search
    const rowApplicationService = getRowApplicationService();

    const result = await rowApplicationService.searchTableRows({
      tableId: TableId.fromNumber(tableId),
      query,
      limit,
      organizationId: OrganizationId.fromNumber(currentOrg.id)
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to search table rows",
      };
    }

    // Import Row type for typing
    const { Row } = await import("@/ddd/domain/tables/value-objects/row");

    // Convert Row entities to relation format for UI
    const relations = result.data.map((row: InstanceType<typeof Row>) => ({
      id: row.id.value,
      value: resolveDisplayValue(row)
    }));

    console.log('[searchTableRows] Converted relations:', relations);

      return {
        success: true,
        data: relations,
      };
    } catch (error) {
      console.error('[searchTableRows] Error searching table rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search table rows",
      };
    }
  });
}

/**
 * Helper function to resolve display value from a Row entity
 * Uses the first text field as display value, or falls back to other fields
 */
function resolveDisplayValue(row: any): string {
  // Try to find a text field to use as display value
  const textField = row.fieldValues?.find((fv: any) => fv.fieldType === 'text' && fv.value);
  if (textField && textField.value) {
    return textField.value as string;
  }

  // Fallback to first non-null field
  const firstField = row.fieldValues?.find((fv: any) => fv.value !== null && fv.value !== undefined);
  if (firstField && firstField.value) {
    return String(firstField.value);
  }

  // Final fallback
  return `Record ${row.id.value}`;
}

/**
 * Get all tables with fields for a specific database
 * Used by template export to include full database structure
 */
export async function getTablesForDatabase(databaseId: number): Promise<TableWithFieldsDTO[]> {
  return withAuthContext(async () => {
    try {
      if (!databaseId) {
        return [];
      }

      await requireResourcePermission("database:view", "database", databaseId);

      const tableApplicationService = getTableApplicationService();
      const tables = await tableApplicationService.getTablesForDatabase(
        DatabaseId.fromNumber(databaseId)
      );

      return tables.map(table => ({
        ...TableMapper.toDTO(table),
        fields: table.fields.map(field => FieldMapper.toDTO(field))
      }));
    } catch (error) {
      console.error("Error fetching tables for database:", error);
      return [];
    }
  });
}
