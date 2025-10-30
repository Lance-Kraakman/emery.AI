'use server'

/**
 * Data Source Server Actions
 *
 * AIDEV-NOTE: Server Actions for view management using ViewApplicationService.
 * These actions are used by Puck components to configure and manage views for TableBlock.
 *
 * Following Next.js best practices:
 * - Use Server Actions (not API routes) for internal operations
 * - Enforce permissions and organization context
 * - Return DTOs for client consumption
 */

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getViewApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import { ViewId } from "@/ddd/domain/views/value-objects/data-source-id";
import { FilterConfig } from "@/ddd/domain/views/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/views/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/views/value-objects/pagination-config";
import { ViewMapper, type ViewDTO } from "@/app/mappers/view-mapper";
import type { Result, CreateViewData, UpdateViewData } from "./types";

/**
 * Create a new view
 *
 * Used by Puck editor to create views for TableBlock components.
 */
export async function createView(
  data: CreateViewData,
  revalidateUrl?: string
): Promise<Result<ViewDTO>> {
  try {
    const session = await requirePermission("data:create");
    const currentOrg = await requireCurrentOrganization();

    const { tableId, name, description } = data;

    if (!name) {
      return {
        success: false,
        error: "View name is required",
      };
    }

    if (!tableId) {
      return {
        success: false,
        error: "Table selection is required",
      };
    }

    const dataSourceService = getViewApplicationService();

    const result = await dataSourceService.createView({
      tableId: TableId.fromNumber(tableId),
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      name,
      description,
      createdBy: UserId.fromString(session.user.id),
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to create view",
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
      data: ViewMapper.toDTO(result.data),
    };
  } catch (error) {
    console.error("Error creating view:", error);
    return {
      success: false,
      error: "Failed to create view",
    };
  }
}

/**
 * Update a view (filters, sorting, pagination)
 *
 * Used by Puck editor when users modify filter/sort configuration.
 */
export async function updateView(
  data: UpdateViewData,
  revalidateUrl?: string
): Promise<Result<ViewDTO>> {
  try {
    await requirePermission("data:manage");
    await requireCurrentOrganization();

    const { id, name, description, filters, sorting, pagination } = data;

    if (!id) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    const dataSourceService = getViewApplicationService();

    // Get existing view
    const existingResult = await dataSourceService.getView(
      ViewId.fromNumber(id)
    );

    if (!existingResult.success || !existingResult.data) {
      return {
        success: false,
        error: "View not found",
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
    const savedView = await dataSourceRepository.save(dataSource);

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath("/data");
    }

    return {
      success: true,
      data: ViewMapper.toDTO(savedView),
    };
  } catch (error) {
    console.error("Error updating view:", error);
    return {
      success: false,
      error: "Failed to update view",
    };
  }
}

/**
 * Delete a view
 */
export async function deleteView(
  id: number,
  revalidateUrl?: string
): Promise<Result> {
  try {
    await requirePermission("data:manage");
    await requireCurrentOrganization();

    if (!id) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    const dataSourceService = getViewApplicationService();

    const result = await dataSourceService.deleteView(
      ViewId.fromNumber(id)
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete view",
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
    console.error("Error deleting view:", error);
    return {
      success: false,
      error: "Failed to delete view",
    };
  }
}

/**
 * Get a view by ID
 */
export async function getView(id: number): Promise<ViewDTO | null> {
  try {
    await requirePermission("data:view");
    await requireCurrentOrganization();

    if (!id) {
      return null;
    }

    const dataSourceService = getViewApplicationService();

    const result = await dataSourceService.getView(
      ViewId.fromNumber(id)
    );

    if (!result.success || !result.data) {
      return null;
    }

    return ViewMapper.toDTO(result.data);
  } catch (error) {
    console.error("Error getting view:", error);
    return null;
  }
}

/**
 * Get all views for a table
 *
 * Used by Puck editor to list available views when configuring TableBlock.
 */
export async function getViewsForTable(
  tableId: number
): Promise<ViewDTO[]> {
  try {
    await requirePermission("data:view");
    await requireCurrentOrganization();

    if (!tableId) {
      return [];
    }

    const dataSourceService = getViewApplicationService();

    const result = await dataSourceService.getViewsByTable(
      TableId.fromNumber(tableId)
    );

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map((ds) => ViewMapper.toDTO(ds));
  } catch (error) {
    console.error("Error getting views for table:", error);
    return [];
  }
}

/**
 * Get all views for the current organization
 */
export async function getViewsForOrganization(): Promise<ViewDTO[]> {
  try {
    await requirePermission("data:view");
    const currentOrg = await requireCurrentOrganization();

    const dataSourceService = getViewApplicationService();

    const result = await dataSourceService.getViewsByOrganization(
      OrganizationId.fromNumber(currentOrg.id)
    );

    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map((ds) => ViewMapper.toDTO(ds));
  } catch (error) {
    console.error("Error getting views for organization:", error);
    return [];
  }
}

/**
 * Execute a view and return rows as DTOs
 *
 * Used by TableBlock to fetch and render data.
 * Returns plain serializable objects (not domain entities).
 */
export async function executeView(
  dataSourceId: number
): Promise<{
  rows: Array<Record<string, any>>;
  fields: Array<{ id: number; name: string; type: string }>;
  totalCount: number;
  pageSize: number;
  offset: number;
} | null> {
  try {
    await requirePermission("data:view");
    await requireCurrentOrganization();

    if (!dataSourceId) {
      return null;
    }

    const dataSourceService = getViewApplicationService();

    // Execute the view
    const result = await dataSourceService.executeView({
      dataSourceId: ViewId.fromNumber(dataSourceId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute view:", result.error);
      return null;
    }

    // Get the schema
    const dataSource = await dataSourceService.getView(
      ViewId.fromNumber(dataSourceId)
    );

    if (!dataSource.success || !dataSource.data) {
      console.error("Failed to get view:", dataSource.error);
      return null;
    }

    const schemaResult = await dataSourceService.getViewSchema(
      ViewId.fromNumber(dataSourceId)
    );

    if (!schemaResult.success || !schemaResult.data) {
      console.error("Failed to get view schema:", schemaResult.error);
      return null;
    }

    // Type-narrow the schema fields after null check
    const fields = schemaResult.data;

    // Convert Row entities to view format (field_{id} keys for grid display)
    const plainRows = result.data.rows.map((row) => row.toViewFormat(fields));

    // Convert TableField VOs to plain objects
    const plainFields = fields.map((field) => ({
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
    console.error("Error executing view:", error);
    return null;
  }
}
