/**
 * DataSource Application Service
 *
 * AIDEV-NOTE: Orchestrates data source operations for Puck page builder integration.
 * Bridges between Puck components and dynamic table data.
 * Handles data source CRUD, query execution, and schema retrieval.
 */

import type { DataSourceRepository } from "@/ddd/domain/data-sources/repositories/data-source-repository";
import type { TableApplicationService } from "@/ddd/application/services/tables/table-application-service";
import { DataSource } from "@/ddd/domain/data-sources/entities/data-source";
import { DataSourceId } from "@/ddd/domain/data-sources/value-objects/data-source-id";
import { FilterConfig } from "@/ddd/domain/data-sources/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/data-sources/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/data-sources/value-objects/pagination-config";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";
import type { Result } from "@/ddd/domain/shared/result";
import type { Row } from "@/ddd/domain/tables/value-objects/row";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import { createDebugLogger } from "@/lib/utils/debug-logger";

const logger = createDebugLogger("DataSourceService");

// Command interfaces
export interface CreateDataSourceCommand {
  name: string;
  tableId: TableId;
  organizationId: OrganizationId;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
}

export interface UpdateDataSourceCommand {
  id: DataSourceId;
  name?: string;
  filters?: FilterConfig[];
  sorting?: SortConfig[];
  pagination?: PaginationConfig;
}

export interface ExecuteDataSourceCommand {
  dataSourceId: DataSourceId;
  overridePagination?: PaginationConfig;
}

// Result types
export interface DataSourceExecutionResult {
  rows: Row[];
  totalCount: number;
  pageSize: number;
  offset: number;
}

export class DataSourceApplicationService {
  constructor(
    private readonly dataSourceRepository: DataSourceRepository,
    private readonly tableApplicationService: TableApplicationService
  ) {}

  /**
   * Create a new data source
   */
  async createDataSource(
    command: CreateDataSourceCommand
  ): Promise<Result<DataSource>> {
    try {
      logger.debug("Creating data source", { name: command.name, tableId: command.tableId.value });

      // 1. Validate table exists
      const table = await this.tableApplicationService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId.value} not found`,
        };
      }

      // 2. Check if name already exists in organization
      const existingDataSource = await this.dataSourceRepository.findByName(
        command.organizationId,
        command.name
      );

      if (existingDataSource) {
        return {
          success: false,
          error: `Data source with name "${command.name}" already exists in this organization`,
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

      // 5. Create data source entity
      const dataSource = DataSource.create({
        name: command.name,
        tableId: command.tableId,
        organizationId: command.organizationId,
        filters: command.filters,
        sorting: command.sorting,
        pagination: command.pagination,
      });

      // 6. Save to repository
      const savedDataSource = await this.dataSourceRepository.save(dataSource);

      logger.debug("Data source created successfully", { id: savedDataSource.id.value });

      return {
        success: true,
        data: savedDataSource,
      };
    } catch (error) {
      logger.error("Error creating data source", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error creating data source",
      };
    }
  }

  /**
   * Update an existing data source
   */
  async updateDataSource(
    command: UpdateDataSourceCommand
  ): Promise<Result<DataSource>> {
    try {
      logger.debug("Updating data source", { id: command.id.value });

      // 1. Find existing data source
      const dataSource = await this.dataSourceRepository.findById(command.id);
      if (!dataSource) {
        return {
          success: false,
          error: `Data source ${command.id.value} not found`,
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
            error: `Data source with name "${command.name}" already exists in this organization`,
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

      // 6. Save updated data source
      const updated = await this.dataSourceRepository.save(dataSource);

      logger.debug("Data source updated successfully", { id: updated.id.value });

      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      logger.error("Error updating data source", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error updating data source",
      };
    }
  }

  /**
   * Delete a data source
   */
  async deleteDataSource(id: DataSourceId): Promise<Result<void>> {
    try {
      logger.debug("Deleting data source", { id: id.value });

      const dataSource = await this.dataSourceRepository.findById(id);
      if (!dataSource) {
        return {
          success: false,
          error: `Data source ${id.value} not found`,
        };
      }

      await this.dataSourceRepository.delete(id);

      logger.debug("Data source deleted successfully", { id: id.value });

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      logger.error("Error deleting data source", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error deleting data source",
      };
    }
  }

  /**
   * Get a data source by ID
   */
  async getDataSource(id: DataSourceId): Promise<Result<DataSource>> {
    try {
      const dataSource = await this.dataSourceRepository.findById(id);

      if (!dataSource) {
        return {
          success: false,
          error: `Data source ${id.value} not found`,
        };
      }

      return {
        success: true,
        data: dataSource,
      };
    } catch (error) {
      logger.error("Error getting data source", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error getting data source",
      };
    }
  }

  /**
   * Get all data sources for a table
   */
  async getDataSourcesByTable(tableId: TableId): Promise<Result<DataSource[]>> {
    try {
      const dataSources = await this.dataSourceRepository.findByTableId(tableId);

      return {
        success: true,
        data: dataSources,
      };
    } catch (error) {
      logger.error("Error getting data sources by table", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error getting data sources",
      };
    }
  }

  /**
   * Get all data sources for an organization
   */
  async getDataSourcesByOrganization(
    organizationId: OrganizationId
  ): Promise<Result<DataSource[]>> {
    try {
      const dataSources = await this.dataSourceRepository.findByOrganizationId(organizationId);

      return {
        success: true,
        data: dataSources,
      };
    } catch (error) {
      logger.error("Error getting data sources by organization", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error getting data sources",
      };
    }
  }

  /**
   * Execute a data source - fetch rows with filters, sorting, and pagination applied
   * AIDEV-NOTE: This is the key method for Puck components to fetch data
   */
  async executeDataSource(
    command: ExecuteDataSourceCommand
  ): Promise<Result<DataSourceExecutionResult>> {
    try {
      logger.debug("Executing data source", { id: command.dataSourceId.value });

      // 1. Get data source
      const dataSource = await this.dataSourceRepository.findById(command.dataSourceId);
      if (!dataSource) {
        return {
          success: false,
          error: `Data source ${command.dataSourceId.value} not found`,
        };
      }

      // 2. Use override pagination if provided, otherwise use data source pagination
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

      logger.debug("Data source executed successfully", {
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
      logger.error("Error executing data source", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error executing data source",
      };
    }
  }

  /**
   * Get the schema (field definitions) for a data source
   */
  async getDataSourceSchema(id: DataSourceId): Promise<Result<TableField[]>> {
    try {
      const dataSource = await this.dataSourceRepository.findById(id);
      if (!dataSource) {
        return {
          success: false,
          error: `Data source ${id.value} not found`,
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
      logger.error("Error getting data source schema", error);
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
