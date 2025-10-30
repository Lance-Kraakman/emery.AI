'use server'

/**
 * Data Source Server Actions
 *
 * AIDEV-NOTE: Server Actions for data source management using DataSourceApplicationService.
 * These actions are used by Puck components to configure and manage data sources for TableBlock.
 *
 * Following Next.js best practices:
 * - Use Server Actions (not API routes) for internal operations
 * - Enforce permissions and organization context
 * - Return DTOs for client consumption
 */

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getDataSourceApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import { DataSourceId } from "@/ddd/domain/data-sources/value-objects/data-source-id";
import { FilterConfig } from "@/ddd/domain/data-sources/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/data-sources/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/data-sources/value-objects/pagination-config";
import { DataSourceMapper, type DataSourceDTO } from "@/app/mappers/data-source-mapper";
import type { Result, CreateDataSourceData, UpdateDataSourceData } from "./types";

/**
 * Create a new data source
 *
 * Used by Puck editor to create data sources for TableBlock components.
 */
export async function createDataSource(
  data: CreateDataSourceData,
  revalidateUrl?: string
): Promise<Result<DataSourceDTO>> {
  try {
    const session = await requirePermission("data:create");
    const currentOrg = await requireCurrentOrganization();

    const { tableId, name, description } = data;

    if (!name) {
      return {
        success: false,
        error: "Data source name is required",
      };
    }

    if (!tableId) {
      return {
        success: false,
        error: "Table selection is required",
      };
    }

    const dataSourceService = getDataSourceApplicationService();

    const result = await dataSourceService.createDataSource({
      tableId: TableId.fromNumber(tableId),
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      name,
      description,
      createdBy: UserId.fromString(session.user.id),
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to create data source",
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath("/data");
    }

    return {
      success: true,
      data: DataSourceMapper.toDTO(result.data),
    };
  } catch (error) {
    console.error("Error creating data source:", error);
    return {
      success: false,
      error: "Failed to create data source",
    };
  }
}

/**
 * Update a data source (filters, sorting, pagination)
 *
 * Used by Puck editor when users modify filter/sort configuration.
 */
export async function updateDataSource(
  data: UpdateDataSourceData,
  revalidateUrl?: string
): Promise<Result<DataSourceDTO>> {
  try {
    await requirePermission("data:update");
    await requireCurrentOrganization();

    const { id, name, description, filters, sorting, pagination } = data;

    if (!id) {
      return {
        success: false,
        error: "Data source ID is required",
      };
    }

    const dataSourceService = getDataSourceApplicationService();

    // Get existing data source
    const existingResult = await dataSourceService.getDataSource(
      DataSourceId.fromNumber(id)
    );

    if (!existingResult.success || !existingResult.data) {
      return {
        success: false,
        error: "Data source not found",
      };
    }

    const dataSource = existingResult.data;

    // Update name/description if provided
    if (name !== undefined) {
      dataSource.updateName(name);
    }

    if (description !== undefined) {
      dataSource.updateDescription(description);
    }

    // Update filters if provided
    if (filters !== undefined) {
      // Clear existing filters and add new ones
      dataSource.clearFilters();
      for (const filter of filters) {
        dataSource.addFilter(
          FilterConfig.create({
            fieldId: filter.fieldId,
            operator: filter.operator as any,
            value: filter.value,
          })
        );
      }
    }

    // Update sorting if provided
    if (sorting !== undefined) {
      // Clear existing sorting and add new ones
      dataSource.clearSorting();
      for (const sort of sorting) {
        dataSource.addSorting(
          SortConfig.create({
            fieldId: sort.fieldId,
            direction: sort.direction,
            priority: sort.priority,
          })
        );
      }
    }

    // Update pagination if provided
    if (pagination !== undefined) {
      dataSource.updatePagination(
        PaginationConfig.create({
          pageSize: pagination.pageSize,
          offset: pagination.offset,
        })
      );
    }

    // Get the repository to save directly
    const dataSourceRepository = (dataSourceService as any).dataSourceRepository;
    const savedDataSource = await dataSourceRepository.save(dataSource);

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath("/data");
    }

    return {
      success: true,
      data: DataSourceMapper.toDTO(savedDataSource),
    };
  } catch (error) {
    console.error("Error updating data source:", error);
    return {
      success: false,
      error: "Failed to update data source",
    };
  }
}

/**
 * Delete a data source
 */
export async function deleteDataSource(
  id: number,
  revalidateUrl?: string
): Promise<Result> {
  try {
    await requirePermission("data:delete");
    await requireCurrentOrganization();

    if (!id) {
      return {
        success: false,
        error: "Data source ID is required",
      };
    }

    const dataSourceService = getDataSourceApplicationService();

    const result = await dataSourceService.deleteDataSource(
      DataSourceId.fromNumber(id)
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete data source",
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath("/data");
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting data source:", error);
    return {
      success: false,
      error: "Failed to delete data source",
    };
  }
}

/**
 * Get a data source by ID
 */
export async function getDataSource(id: number): Promise<DataSourceDTO | null> {
  try {
    await requirePermission("data:read");
    await requireCurrentOrganization();

    if (!id) {
      return null;
    }

    const dataSourceService = getDataSourceApplicationService();

    const result = await dataSourceService.getDataSource(
      DataSourceId.fromNumber(id)
    );

    if (!result.success || !result.data) {
      return null;
    }

    return DataSourceMapper.toDTO(result.data);
  } catch (error) {
    console.error("Error getting data source:", error);
    return null;
  }
}

/**
 * Get all data sources for a table
 *
 * Used by Puck editor to list available data sources when configuring TableBlock.
 */
export async function getDataSourcesForTable(
  tableId: number
): Promise<DataSourceDTO[]> {
  try {
    await requirePermission("data:read");
    await requireCurrentOrganization();

    if (!tableId) {
      return [];
    }

    const dataSourceService = getDataSourceApplicationService();

    const result = await dataSourceService.getDataSourcesByTable(
      TableId.fromNumber(tableId)
    );

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map((ds) => DataSourceMapper.toDTO(ds));
  } catch (error) {
    console.error("Error getting data sources for table:", error);
    return [];
  }
}

/**
 * Get all data sources for the current organization
 */
export async function getDataSourcesForOrganization(): Promise<DataSourceDTO[]> {
  try {
    await requirePermission("data:read");
    const currentOrg = await requireCurrentOrganization();

    const dataSourceService = getDataSourceApplicationService();

    const result = await dataSourceService.getDataSourcesByOrganization(
      OrganizationId.fromNumber(currentOrg.id)
    );

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map((ds) => DataSourceMapper.toDTO(ds));
  } catch (error) {
    console.error("Error getting data sources for organization:", error);
    return [];
  }
}

/**
 * Execute a data source and return rows as DTOs
 *
 * Used by TableBlock to fetch and render data.
 * Returns plain serializable objects (not domain entities).
 */
export async function executeDataSource(
  dataSourceId: number
): Promise<{
  rows: Array<Record<string, any>>;
  fields: Array<{ id: number; name: string; type: string }>;
  totalCount: number;
  pageSize: number;
  offset: number;
} | null> {
  try {
    await requirePermission("data:read");
    await requireCurrentOrganization();

    if (!dataSourceId) {
      return null;
    }

    const dataSourceService = getDataSourceApplicationService();

    // Execute the data source
    const result = await dataSourceService.executeDataSource({
      dataSourceId: DataSourceId.fromNumber(dataSourceId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute data source:", result.error);
      return null;
    }

    // Get the schema
    const dataSource = await dataSourceService.getDataSource(
      DataSourceId.fromNumber(dataSourceId)
    );

    if (!dataSource.success || !dataSource.data) {
      console.error("Failed to get data source:", dataSource.error);
      return null;
    }

    const schemaResult = await dataSourceService.getDataSourceSchema(
      DataSourceId.fromNumber(dataSourceId)
    );

    if (!schemaResult.success || !schemaResult.data) {
      console.error("Failed to get data source schema:", schemaResult.error);
      return null;
    }

    // Convert Row entities to plain objects
    const plainRows = result.data.rows.map((row) => row.toPlainObject());

    // Convert TableField VOs to plain objects
    const plainFields = schemaResult.data.map((field) => ({
      id: field.id.value,
      name: field.name,
      type: field.type,
    }));

    return {
      rows: plainRows,
      fields: plainFields,
      totalCount: result.data.totalCount,
      pageSize: result.data.pageSize,
      offset: result.data.offset,
    };
  } catch (error) {
    console.error("Error executing data source:", error);
    return null;
  }
}
