/**
 * Puck Table Metadata Resolver
 *
 * AIDEV-NOTE: Server-side utility for pre-loading table and field data
 * that Puck components can access during resolveData() hooks.
 *
 * This follows the metadata pattern from Puck's resolveAllData() function.
 * Instead of using Context (which doesn't work in RSC), we pass metadata
 * explicitly through the resolveAllData call.
 */

import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import type { DynamicTable } from "@/ddd/domain/tables/entities/dynamic-table";
import { DIContainer } from "@/ddd/application/di/container";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger("PuckTableMetadata");

/**
 * Table metadata available to Puck components
 */
export interface TableMetadata {
  tableId: number;
  tableName: string;
  fields: TableField[];
  fieldMap: Map<number, TableField>;
  organizationId: number;
}

/**
 * Extended metadata for pages that use table data
 */
export interface PuckPageMetadata {
  // Organization context
  organizationId: number;

  // Table metadata (if page is bound to a table)
  table?: TableMetadata;

  // Additional context that components might need
  [key: string]: any;
}

/**
 * Resolve table metadata for Puck components
 *
 * This function pre-loads table and field data before page rendering,
 * making it available to all components via the metadata parameter
 * in their resolveData() hooks.
 *
 * @example
 * ```typescript
 * // In a Next.js page component
 * export default async function Page({ params }) {
 *   const data = await getPageData(params.slug);
 *
 *   // Resolve table metadata if page uses tables
 *   const metadata = await resolveTableMetadata({
 *     tableId: 1,
 *     organizationId: 1
 *   });
 *
 *   // Pass to Puck's resolveAllData
 *   const resolvedData = await resolveAllData(data, config, metadata);
 *
 *   return <Render config={config} data={resolvedData} />;
 * }
 * ```
 */
export async function resolveTableMetadata(params: {
  tableId: number;
  organizationId: number;
}): Promise<PuckPageMetadata> {
  try {
    logger.debug("Resolving table metadata", params);

    const container = DIContainer.getInstance();
    const tableApplicationService = container.get("TableApplicationService");

    // Fetch table with fields
    const table = await tableApplicationService.getTable(
      TableId.fromNumber(params.tableId)
    );

    if (!table) {
      logger.debug("Table not found", { tableId: params.tableId });
      return {
        organizationId: params.organizationId,
      };
    }

    // Build field map for quick lookups
    const fieldMap = new Map<number, TableField>();
    for (const field of table.fields) {
      fieldMap.set(field.id.value, field);
    }

    const tableMetadata: TableMetadata = {
      tableId: params.tableId,
      tableName: table.name,
      fields: table.fields,
      fieldMap,
      organizationId: params.organizationId,
    };

    logger.debug("Table metadata resolved", {
      tableId: params.tableId,
      fieldCount: table.fields.length,
    });

    return {
      organizationId: params.organizationId,
      table: tableMetadata,
    };
  } catch (error) {
    logger.error("Error resolving table metadata", error);
    // Return minimal metadata on error - don't fail the page load
    return {
      organizationId: params.organizationId,
    };
  }
}

/**
 * Resolve metadata for multiple tables
 *
 * Useful when a page needs data from multiple tables.
 */
export async function resolveMultiTableMetadata(params: {
  tableIds: number[];
  organizationId: number;
}): Promise<PuckPageMetadata> {
  try {
    logger.debug("Resolving metadata for multiple tables", {
      tableIds: params.tableIds,
      organizationId: params.organizationId,
    });

    const container = DIContainer.getInstance();
    const tableApplicationService = container.get("TableApplicationService");

    // Fetch all tables in parallel
    const tablePromises = params.tableIds.map((tableId) =>
      tableApplicationService.getTable(TableId.fromNumber(tableId))
    );

    const tables = await Promise.all(tablePromises);

    // Build metadata for each table
    const tableMetadataMap = new Map<number, TableMetadata>();

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      if (!table) continue;

      const tableId = params.tableIds[i];
      const fieldMap = new Map<number, TableField>();

      for (const field of table.fields) {
        fieldMap.set(field.id.value, field);
      }

      tableMetadataMap.set(tableId, {
        tableId,
        tableName: table.name,
        fields: table.fields,
        fieldMap,
        organizationId: params.organizationId,
      });
    }

    logger.debug("Multi-table metadata resolved", {
      tableCount: tableMetadataMap.size,
    });

    return {
      organizationId: params.organizationId,
      tables: tableMetadataMap,
    };
  } catch (error) {
    logger.error("Error resolving multi-table metadata", error);
    return {
      organizationId: params.organizationId,
    };
  }
}

/**
 * Helper to get table metadata from Puck component's metadata parameter
 *
 * Use this in your component's resolveData hook to access table info.
 *
 * @example
 * ```typescript
 * export const MyComponent: ComponentConfig = {
 *   resolveData: async ({ props }, { metadata }) => {
 *     const tableMetadata = getTableFromMetadata(metadata);
 *     if (!tableMetadata) return { props };
 *
 *     // Use table metadata
 *     const field = tableMetadata.fieldMap.get(props.fieldId);
 *     // ...
 *   }
 * }
 * ```
 */
export function getTableFromMetadata(
  metadata: Record<string, any>
): TableMetadata | undefined {
  return metadata?.table as TableMetadata | undefined;
}

/**
 * Helper to get a specific table from multi-table metadata
 */
export function getTableByIdFromMetadata(
  metadata: Record<string, any>,
  tableId: number
): TableMetadata | undefined {
  const tables = metadata?.tables as Map<number, TableMetadata> | undefined;
  return tables?.get(tableId);
}
