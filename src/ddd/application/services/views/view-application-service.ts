/**
 * View Application Service
 *
 * AIDEV-NOTE: Orchestrates view operations for Puck page builder integration.
 * Bridges between Puck components and dynamic table data.
 * Handles view CRUD, query execution, and schema retrieval.
 */

import type { ViewRepository } from "@/ddd/domain/views/repositories/view-repository";
import type { TableApplicationService } from "@/ddd/application/services/tables/table-application-service";
import { View } from "@/ddd/domain/views/entities/view";
import { ViewId } from "@/ddd/domain/views/value-objects/view-id";
import { FilterConfig } from "@/ddd/domain/views/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/views/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/views/value-objects/pagination-config";
import { FieldMapping } from "@/ddd/domain/views/value-objects/field-mapping";
import { ViewType } from "@/ddd/domain/views/value-objects/view-type";
import { ViewConfig } from "@/ddd/domain/views/value-objects/view-config";
import { AggregationConfig } from "@/ddd/domain/views/value-objects/aggregation-config";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";
import { UserId } from "@/ddd/domain/shared/value-objects/user-id";
import type { Result } from "@/ddd/domain/shared/result";
import type { Row } from "@/ddd/domain/tables/value-objects/row";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger("ViewService");

// Command interfaces
export interface CreateViewCommand {
  name: string;
  description?: string;
  tableId: TableId;
  organizationId: OrganizationId;
  createdBy?: UserId;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
  fieldMappings?: FieldMapping[];
  viewType?: ViewType;
  viewConfig?: ViewConfig;
}

export interface UpdateViewCommand {
  id: ViewId;
  name?: string;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
  fieldMappings?: FieldMapping[];
}

export interface ExecuteViewCommand {
  dataSourceId: ViewId;
  overridePagination?: PaginationConfig;
}

export interface ExecuteAggregationCommand {
  viewId: ViewId;
}

// Result types
export interface ViewExecutionResult {
  rows: Row[];
  totalCount: number;
  pageSize: number;
  offset: number;
}

export interface AggregationResult {
  fieldId: number;
  aggregationType: string;
  value: any;
  label?: string;
  formatType?: string;
}

export class ViewApplicationService {
  constructor(
    private readonly dataSourceRepository: ViewRepository,
    private readonly tableApplicationService: TableApplicationService
  ) {}

  /**
   * Create a new view
   */
  async createView(
    command: CreateViewCommand
  ): Promise<Result<View>> {
    try {
      logger.debug("Creating view", { name: command.name, tableId: command.tableId.value });

      // 1. Validate table exists
      const table = await this.tableApplicationService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId.value} not found`,
        };
      }

      // 2. Check if name already exists in organization
      const existingView = await this.dataSourceRepository.findByName(
        command.organizationId,
        command.name
      );

      if (existingView) {
        return {
          success: false,
          error: `View with name "${command.name}" already exists in this organization`,
        };
      }

      // 3. Validate filters reference valid fields
      if (command.filters && command.filters.length > 0) {
        const validFieldIds = new Set(table.fields.map((f: TableField) => f.id.value));

        for (const filter of command.filters) {
          if (!validFieldIds.has(filter.fieldId)) {
            return {
              success: false,
              error: `Filter references invalid field ID: ${filter.fieldId}`,
            };
          }
        }
      }

      // 4. Validate sorting references valid fields
      if (command.sorting && command.sorting.length > 0) {
        const validFieldIds = new Set(table.fields.map((f: TableField) => f.id.value));

        for (const sort of command.sorting) {
          if (!validFieldIds.has(sort.fieldId)) {
            return {
              success: false,
              error: `Sort references invalid field ID: ${sort.fieldId}`,
            };
          }
        }
      }

      // 5. Validate field mappings reference valid fields
      if (command.fieldMappings && command.fieldMappings.length > 0) {
        const validFieldIds = new Set(table.fields.map((f: TableField) => f.id.value));

        for (const mapping of command.fieldMappings) {
          if (!validFieldIds.has(mapping.sourceFieldId)) {
            return {
              success: false,
              error: `Field mapping references invalid field ID: ${mapping.sourceFieldId}`,
            };
          }
        }
      }

      // 6. Create view entity
      const dataSource = View.create({
        name: command.name,
        description: command.description,
        tableId: command.tableId,
        organizationId: command.organizationId,
        createdBy: command.createdBy?.value,
        filters: command.filters,
        sorting: command.sorting,
        pagination: command.pagination,
        fieldMappings: command.fieldMappings,
        viewType: command.viewType || ViewType.grid(),
        viewConfig: command.viewConfig || ViewConfig.createGrid(),
      });

      // 6. Save to repository
      const savedView = await this.dataSourceRepository.save(dataSource);

      logger.debug("View created successfully", { id: savedView.id.value });

      return {
        success: true,
        data: savedView,
      };
    } catch (error) {
      logger.error("Error creating view", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating view",
      };
    }
  }

  /**
   * Update an existing view
   */
  async updateView(
    command: UpdateViewCommand
  ): Promise<Result<View>> {
    try {
      logger.debug("Updating view", { id: command.id.value });

      // 1. Find existing view
      const dataSource = await this.dataSourceRepository.findById(command.id);
      if (!dataSource) {
        return {
          success: false,
          error: `View ${command.id.value} not found`,
        };
      }

      // 2. Update name if provided
      if (command.name && command.name !== dataSource.name) {
        // Check if new name already exists
        const existingByName = await this.dataSourceRepository.findByName(
          dataSource.organizationId,
          command.name
        );

        if (existingByName && !existingByName.id.equals(command.id)) {
          return {
            success: false,
            error: `View with name "${command.name}" already exists in this organization`,
          };
        }

        dataSource.updateName(command.name);
      }

      // 3. Update filters if provided
      if (command.filters !== undefined) {
        // Clear existing filters
        dataSource.clearFilters();

        // Add new filters
        for (const filter of command.filters) {
          dataSource.addFilter(filter);
        }
      }

      // 4. Update sorting if provided
      if (command.sorting !== undefined) {
        // Clear existing sorting
        dataSource.clearSorting();

        // Add new sorting
        for (const sort of command.sorting) {
          dataSource.addSorting(sort);
        }
      }

      // 5. Update pagination if provided
      if (command.pagination) {
        dataSource.updatePagination(command.pagination);
      }

      // 6. Update field mappings if provided
      if (command.fieldMappings !== undefined) {
        // Clear existing mappings and set new ones
        dataSource.setFieldMappings(command.fieldMappings);
      }

      // 7. Save updated view
      const updated = await this.dataSourceRepository.save(dataSource);

      logger.debug("View updated successfully", { id: updated.id.value });

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      logger.error("Error updating view", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error updating view",
      };
    }
  }

  /**
   * Delete a view
   */
  async deleteView(id: ViewId): Promise<Result<void>> {
    try {
      logger.debug("Deleting view", { id: id.value });

      const dataSource = await this.dataSourceRepository.findById(id);
      if (!dataSource) {
        return {
          success: false,
          error: `View ${id.value} not found`,
        };
      }

      await this.dataSourceRepository.delete(id);

      logger.debug("View deleted successfully", { id: id.value });

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      logger.error("Error deleting view", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error deleting view",
      };
    }
  }

  /**
   * Get a view by ID
   */
  async getView(id: ViewId): Promise<Result<View>> {
    try {
      const dataSource = await this.dataSourceRepository.findById(id);

      if (!dataSource) {
        return {
          success: false,
          error: `View ${id.value} not found`,
        };
      }

      return {
        success: true,
        data: dataSource,
      };
    } catch (error) {
      logger.error("Error getting view", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error getting view",
      };
    }
  }

  /**
   * Get all views for a table
   */
  async getViewsByTable(tableId: TableId): Promise<Result<View[]>> {
    try {
      const dataSources = await this.dataSourceRepository.findByTableId(tableId);

      return {
        success: true,
        data: dataSources,
      };
    } catch (error) {
      logger.error("Error getting views by table", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error getting views",
      };
    }
  }

  /**
   * Get all views for an organization
   */
  async getViewsByOrganization(
    organizationId: OrganizationId
  ): Promise<Result<View[]>> {
    try {
      const dataSources = await this.dataSourceRepository.findByOrganizationId(organizationId);

      return {
        success: true,
        data: dataSources,
      };
    } catch (error) {
      logger.error("Error getting views by organization", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error getting views",
      };
    }
  }

  /**
   * Execute a view - fetch rows with filters, sorting, and pagination applied
   * AIDEV-NOTE: This is the key method for Puck components to fetch data
   */
  async executeView(
    command: ExecuteViewCommand
  ): Promise<Result<ViewExecutionResult>> {
    try {
      logger.debug("Executing view", { id: command.dataSourceId.value });

      // 1. Get view
      const dataSource = await this.dataSourceRepository.findById(command.dataSourceId);
      if (!dataSource) {
        return {
          success: false,
          error: `View ${command.dataSourceId.value} not found`,
        };
      }

      // 2. Use override pagination if provided, otherwise use view pagination
      const pagination = command.overridePagination ?? dataSource.pagination;

      // 3. Fetch rows from table
      // AIDEV-NOTE: For now, fetch all rows and filter/sort in memory
      // In production, this should be pushed down to the database query
      const rows = await this.tableApplicationService.getRows(dataSource.tableId, {
        limit: 10000, // Fetch large batch for in-memory processing
        offset: 0,
      });

      // 4. Apply filters (in-memory for now)
      let filteredRows = rows;
      if (dataSource.hasFilters()) {
        filteredRows = this.applyFilters(filteredRows, dataSource.filters);
      }

      // 5. Apply sorting (in-memory for now)
      if (dataSource.hasSorting()) {
        filteredRows = this.applySorting(filteredRows, dataSource.getSortedSorting());
      }

      // 6. Apply pagination (slice filtered/sorted results)
      const paginatedRows = filteredRows.slice(
        pagination.offset,
        pagination.offset + pagination.pageSize
      );

      logger.debug("View executed successfully", {
        id: command.dataSourceId.value,
        rowCount: paginatedRows.length,
      });

      return {
        success: true,
        data: {
          rows: paginatedRows,
          totalCount: filteredRows.length,
          pageSize: pagination.pageSize,
          offset: pagination.offset,
        },
      };
    } catch (error) {
      logger.error("Error executing view", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error executing view",
      };
    }
  }

  /**
   * Execute aggregations for a metric/dashboard view
   *
   * AIDEV-NOTE: This method delegates aggregation computation to the backend gRPC service.
   * Aggregations are computed at the database layer (PostgreSQL/DuckDB via Python),
   * never in Node.js/browser. This ensures proper performance for large datasets.
   *
   * Flow:
   * 1. Get view and validate it requires aggregations
   * 2. Extract aggregations from viewConfig
   * 3. Call table service with aggregations parameter
   * 4. Backend applies filters then aggregations (WHERE before GROUP BY)
   * 5. Return pre-computed aggregation results
   */
  async executeAggregations(
    command: ExecuteAggregationCommand
  ): Promise<Result<AggregationResult[]>> {
    try {
      logger.debug("Executing aggregations", { viewId: command.viewId.value });

      // 1. Get view
      const view = await this.dataSourceRepository.findById(command.viewId);
      if (!view) {
        return {
          success: false,
          error: `View ${command.viewId.value} not found`,
        };
      }

      // 2. Verify view type supports aggregations
      if (!view.requiresAggregation()) {
        return {
          success: false,
          error: `View type '${view.viewType.value}' does not support aggregations`,
        };
      }

      // 3. Get aggregations from view config
      const aggregations = view.getAggregations();
      if (aggregations.length === 0) {
        return {
          success: false,
          error: "View has no aggregations configured",
        };
      }

      logger.debug("Aggregations extracted", {
        count: aggregations.length,
        types: aggregations.map(a => a.aggregationType),
      });

      // 4. Get table for context
      const table = await this.tableApplicationService.getTable(view.tableId);
      if (!table) {
        return {
          success: false,
          error: "Failed to fetch table",
        };
      }

      // 5. Get table fields for mapping field IDs to names
      const tableFields = table.fields;

      // 6. Convert aggregations to format expected by table service
      // AIDEV-NOTE: S3 Parquet files use actual field names, not field_{id} format
      // We must map field IDs to actual field names for Python/Polars to find the columns
      const aggregationParams = aggregations.map(agg => {
        // Look up the actual field to get its name
        const field = tableFields.find(f => f.id.value === agg.fieldId);
        if (!field) {
          throw new Error(`Field ${agg.fieldId} not found in table ${table.id.value}`);
        }

        logger.debug("Mapping aggregation field", {
          fieldId: agg.fieldId,
          fieldName: field.name,
          aggregationType: agg.aggregationType,
        });

        return {
          fieldId: field.name,  // Use actual field name for S3 Parquet columns
          type: agg.aggregationType,
          alias: field.name,    // Alias matches field name
          formatType: agg.formatType || 'number',
        };
      });

      // 7. Execute query with aggregations via table service
      // AIDEV-NOTE: This calls DynamicTableDataLake → TableGrpcMapper → Python QueryRows
      // Python applies filters THEN aggregations for correct SQL semantics
      const result = await this.tableApplicationService.getRows(view.tableId, {
        limit: 0, // No limit for aggregations
        offset: 0,
        aggregations: aggregationParams,
      });

      // 8. Parse aggregated results from returned rows
      // Aggregated data comes back as a single row with computed values
      if (result.length === 0) {
        return {
          success: false,
          error: "No aggregation results returned",
        };
      }

      const aggregatedRow = result[0];

      // Debug logging to verify column names
      const expectedFieldNames = aggregations.map(a => {
        const field = tableFields.find(f => f.id.value === a.fieldId);
        return field?.name || `field_${a.fieldId}`;
      });

      logger.debug("Aggregated row columns", {
        columns: Object.keys(aggregatedRow.toPlainObject()),
        expectedFields: expectedFieldNames,
      });

      const results: AggregationResult[] = aggregations.map((agg, index) => {
        // Look up field name for this aggregation
        const field = tableFields.find(f => f.id.value === agg.fieldId);
        if (!field) {
          throw new Error(`Field ${agg.fieldId} not found during result extraction`);
        }

        // Use actual field name to access result from S3 Parquet
        const fieldValue = aggregatedRow.getFieldValue(field.name);
        const value = fieldValue?.value;

        logger.debug("Extracting aggregation value", {
          fieldId: agg.fieldId,
          fieldName: field.name,
          hasFieldValue: !!fieldValue,
          value,
        });

        return {
          fieldId: agg.fieldId,
          aggregationType: agg.aggregationType,
          value: value,
          label: agg.label,  // Preserve original label for display
          formatType: agg.formatType,
        };
      });

      logger.summary("Aggregations executed successfully", {
        viewId: command.viewId.value,
        resultCount: results.length,
      });

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      logger.error("Error executing aggregations", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error executing aggregations",
      };
    }
  }

  /**
   * Get the schema (field definitions) for a view
   */
  async getViewSchema(id: ViewId): Promise<Result<TableField[]>> {
    try {
      const dataSource = await this.dataSourceRepository.findById(id);
      if (!dataSource) {
        return {
          success: false,
          error: `View ${id.value} not found`,
        };
      }

      const table = await this.tableApplicationService.getTable(dataSource.tableId);
      if (!table) {
        return {
          success: false,
          error: "Failed to fetch table schema",
        };
      }

      return {
        success: true,
        data: table.fields,
      };
    } catch (error) {
      logger.error("Error getting view schema", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error getting schema",
      };
    }
  }

  /**
   * Apply filters to rows (in-memory implementation)
   * AIDEV-NOTE: This is a temporary implementation. In production, filters should be
   * applied at the database level for better performance with large datasets.
   */
  private applyFilters(rows: Row[], filters: readonly FilterConfig[]): Row[] {
    return rows.filter((row) => {
      const rowData = row.toPlainObject();
      return filters.every((filter) => {
        const fieldValue = rowData[`field_${filter.fieldId}`];

        switch (filter.operator) {
          case "equals":
            return fieldValue === filter.value;
          case "not_equals":
            return fieldValue !== filter.value;
          case "contains":
            return String(fieldValue).includes(String(filter.value));
          case "not_contains":
            return !String(fieldValue).includes(String(filter.value));
          case "starts_with":
            return String(fieldValue).startsWith(String(filter.value));
          case "ends_with":
            return String(fieldValue).endsWith(String(filter.value));
          case "greater_than":
            return Number(fieldValue) > Number(filter.value);
          case "greater_than_or_equal":
            return Number(fieldValue) >= Number(filter.value);
          case "less_than":
            return Number(fieldValue) < Number(filter.value);
          case "less_than_or_equal":
            return Number(fieldValue) <= Number(filter.value);
          case "is_empty":
            return !fieldValue || fieldValue === "";
          case "is_not_empty":
            return !!fieldValue && fieldValue !== "";
          case "is_true":
            return fieldValue === true;
          case "is_false":
            return fieldValue === false;
          default:
            return true;
        }
      });
    });
  }

  /**
   * Apply sorting to rows (in-memory implementation)
   * AIDEV-NOTE: This is a temporary implementation. In production, sorting should be
   * applied at the database level for better performance.
   */
  private applySorting(rows: Row[], sorting: readonly SortConfig[]): Row[] {
    return [...rows].sort((a, b) => {
      const aData = a.toPlainObject();
      const bData = b.toPlainObject();

      for (const sort of sorting) {
        const aValue = aData[`field_${sort.fieldId}`];
        const bValue = bData[`field_${sort.fieldId}`];

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        if (comparison !== 0) {
          return sort.direction === "asc" ? comparison : -comparison;
        }
      }
      return 0;
    });
  }
}
