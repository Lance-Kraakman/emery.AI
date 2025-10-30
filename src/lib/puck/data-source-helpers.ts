/**
 * Puck Data Source Helpers
 *
 * AIDEV-NOTE: Server-side helpers for Puck components to work with data sources.
 * These are simple utility functions (not a registry class/provider) that components
 * can use in their resolveData hooks to fetch filtered, sorted data.
 */

import { DataSourceId } from "@/ddd/domain/data-sources/value-objects/data-source-id";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";
import { PaginationConfig } from "@/ddd/domain/data-sources/value-objects/pagination-config";
import type { DataSource } from "@/ddd/domain/data-sources/entities/data-source";
import type { Row } from "@/ddd/domain/tables/value-objects/row";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import { DIContainer } from "@/ddd/application/di/container";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger("PuckDataSource");

/**
 * Data source execution result for Puck components
 */
export interface DataSourceResult {
  rows: Row[];
  totalCount: number;
  pageSize: number;
  offset: number;
  fields: TableField[];
}

/**
 * Get a data source by ID
 *
 * Use this in resolveData to fetch a configured data source.
 *
 * @example
 * ```typescript
 * resolveData: async ({ props }) => {
 *   const dataSource = await getDataSource(props.dataSourceId);
 *   if (!dataSource) return { props };
 *   // ... use data source
 * }
 * ```
 */
export async function getDataSource(
  dataSourceId: number
): Promise<DataSource | null> {
  try {
    const container = DIContainer.getInstance();
    const dataSourceService = container.get("DataSourceApplicationService");

    const result = await dataSourceService.getDataSource(
      DataSourceId.fromNumber(dataSourceId)
    );

    if (!result.success || !result.data) {
      logger.debug("Data source not found", { dataSourceId });
      return null;
    }

    return result.data;
  } catch (error) {
    logger.error("Error fetching data source", error);
    return null;
  }
}

/**
 * Execute a data source and get rows
 *
 * This applies filters, sorting, and pagination configured in the data source.
 * Use this in resolveData to fetch the actual row data.
 *
 * @example
 * ```typescript
 * resolveData: async ({ props }) => {
 *   const result = await executeDataSource(props.dataSourceId);
 *   if (!result) return { props };
 *
 *   return {
 *     props: {
 *       ...props,
 *       _rows: result.rows,
 *       _totalCount: result.totalCount
 *     }
 *   };
 * }
 * ```
 */
export async function executeDataSource(
  dataSourceId: number,
  options?: {
    overridePagination?: PaginationConfig;
  }
): Promise<DataSourceResult | null> {
  try {
    const container = DIContainer.getInstance();
    const dataSourceService = container.get("DataSourceApplicationService");

    // Execute the data source
    const executionResult = await dataSourceService.executeDataSource({
      dataSourceId: DataSourceId.fromNumber(dataSourceId),
      overridePagination: options?.overridePagination,
    });

    if (!executionResult.success || !executionResult.data) {
      logger.debug("Failed to execute data source", {
        dataSourceId,
        error: executionResult.error,
      });
      return null;
    }

    // Get the schema
    const schemaResult = await dataSourceService.getDataSourceSchema(
      DataSourceId.fromNumber(dataSourceId)
    );

    if (!schemaResult.success || !schemaResult.data) {
      logger.debug("Failed to get data source schema", { dataSourceId });
      return null;
    }

    return {
      rows: executionResult.data.rows,
      totalCount: executionResult.data.totalCount,
      pageSize: executionResult.data.pageSize,
      offset: executionResult.data.offset,
      fields: schemaResult.data,
    };
  } catch (error) {
    logger.error("Error executing data source", error);
    return null;
  }
}

/**
 * Get all data sources for a table
 *
 * Useful for building data source selection dropdowns in the Puck editor.
 */
export async function getDataSourcesForTable(
  tableId: number
): Promise<DataSource[]> {
  try {
    const container = DIContainer.getInstance();
    const dataSourceService = container.get("DataSourceApplicationService");

    const result = await dataSourceService.getDataSourcesByTable(
      TableId.fromNumber(tableId)
    );

    if (!result.success || !result.data) {
      logger.debug("No data sources found for table", { tableId });
      return [];
    }

    return result.data;
  } catch (error) {
    logger.error("Error fetching data sources for table", error);
    return [];
  }
}

/**
 * Get all data sources for an organization
 *
 * Useful for organization-wide data source management.
 */
export async function getDataSourcesForOrganization(
  organizationId: number
): Promise<DataSource[]> {
  try {
    const container = DIContainer.getInstance();
    const dataSourceService = container.get("DataSourceApplicationService");

    const result = await dataSourceService.getDataSourcesByOrganization(
      OrganizationId.fromNumber(organizationId)
    );

    if (!result.success || !result.data) {
      logger.debug("No data sources found for organization", { organizationId });
      return [];
    }

    return result.data;
  } catch (error) {
    logger.error("Error fetching data sources for organization", error);
    return [];
  }
}

/**
 * Helper to convert Row[] to plain objects for easier use in components
 *
 * @example
 * ```typescript
 * const result = await executeDataSource(dataSourceId);
 * const plainRows = rowsToPlainObjects(result.rows);
 * // Now you can access: plainRows[0].field_1, etc.
 * ```
 */
export function rowsToPlainObjects(rows: Row[]): Record<string, any>[] {
  return rows.map((row) => row.toPlainObject());
}

/**
 * Helper to extract a specific field value from a row
 */
export function getFieldValue(
  row: Row,
  fieldId: number
): string | number | boolean | null | undefined {
  const plainRow = row.toPlainObject();
  return plainRow[`field_${fieldId}`];
}

/**
 * Helper to format row data for display based on field mappings
 *
 * @example
 * ```typescript
 * const mappings = [
 *   { sourceFieldId: 1, displayName: 'Name' },
 *   { sourceFieldId: 2, displayName: 'Email' }
 * ];
 *
 * const formatted = formatRowWithMappings(row, mappings);
 * // Returns: { Name: 'John', Email: 'john@example.com' }
 * ```
 */
export function formatRowWithMappings(
  row: Row,
  mappings: Array<{ sourceFieldId: number; displayName: string }>
): Record<string, any> {
  const plainRow = row.toPlainObject();
  const formatted: Record<string, any> = {};

  for (const mapping of mappings) {
    const value = plainRow[`field_${mapping.sourceFieldId}`];
    formatted[mapping.displayName] = value;
  }

  return formatted;
}
