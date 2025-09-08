'use server'

// AIDEV-NOTE: Server Actions for table management using TableApplicationService
// Uses application service for business logic and validation

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTableApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, DatabaseId, UserId } from "@/ddd/domain/shared/value-objects";
import type { Result, CreateTableData } from "./types";
import type { CreateTableCommand } from "@/ddd/application/services/tables/table-application-service";
import { TableMapper, type TableDTO } from "@/app/mappers/table-mapper";

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

export async function createTable(data: CreateTableData & { databaseId: number; description?: string }, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:create");
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
      organizationId: OrganizationId.fromNumber(currentOrg.id.value),
      createdBy: UserId.fromString(session.user.id),
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

    // Note: RAG reindexing is now handled automatically by database triggers
    
    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/data'); // Default path for table operations
    }
    
    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error("Error creating table:", error);
    return {
      success: false,
      error: "Failed to create table",
    };
  }
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
  try {
    const currentOrg = await requireCurrentOrganization();
    const tableApplicationService = getTableApplicationService();
    
    const tableList = await tableApplicationService.getTablesForOrganization(OrganizationId.fromNumber(currentOrg.id.value));

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
}

export async function deleteTable(tableId: number, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("data:manage");
    const currentOrg = await requireCurrentOrganization();
    
    if (!tableId) {
      return {
        success: false,
        error: "Table ID is required",
      };
    }

    const tableApplicationService = getTableApplicationService();

    const result = await tableApplicationService.deleteTable(TableId.fromNumber(tableId));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete table"
      };
    }

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
