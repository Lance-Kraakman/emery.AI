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
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getViewApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, UserId } from "@/ddd/domain/shared/value-objects";
import { ViewId } from "@/ddd/domain/views/value-objects/view-id";
import { FilterConfig } from "@/ddd/domain/views/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/views/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/views/value-objects/pagination-config";
import { FieldMapping } from "@/ddd/domain/views/value-objects/field-mapping";
import { ViewType } from "@/ddd/domain/views/value-objects/view-type";
import { ViewConfig } from "@/ddd/domain/views/value-objects/view-config";
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

    const { tableId, name, description, fieldMappings, filters, sorting, viewType, viewConfig } = data;

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

    // Fetch fields to convert field names to IDs for filters
    const { getFields } = await import('./fields');
    const fields = await getFields(tableId);
    const fieldNameToIdMap = new Map(fields.map(f => [f.name, f.id]));

    // Convert plain field mapping objects to FieldMapping value objects
    const fieldMappingVOs = fieldMappings?.map((mapping) =>
      FieldMapping.create({
        sourceFieldId: mapping.sourceFieldId,
        displayName: mapping.displayName,
        visible: mapping.visible,
        order: mapping.order,
      })
    );

    // Convert plain filter objects to FilterConfig value objects
    // AIDEV-NOTE: Filters from UI use field names, need to convert to field IDs
    // Also need to map UI operators to domain operators
    const uiToDomainOperatorMap: Record<string, string> = {
      'eq': 'equals',
      'ne': 'not_equals',
      'ilike': 'contains',
      'like': 'contains',
      'gt': 'greater_than',
      'gte': 'greater_than_or_equal',
      'lt': 'less_than',
      'lte': 'less_than_or_equal',
      'is_null': 'is_empty',
      'is_not_null': 'is_not_empty',
    };

    const filterVOs = filters?.map((filter) => {
      const fieldId = fieldNameToIdMap.get(filter.field);
      if (!fieldId) {
        throw new Error(`Field "${filter.field}" not found in table`);
      }

      const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;

      return FilterConfig.create({
        fieldId,
        operator: domainOperator as any,
        value: filter.value,
      });
    });

    // Convert plain sorting objects to SortConfig value objects
    const sortingVOs = sorting?.map((sort) =>
      SortConfig.create({
        fieldId: sort.fieldId,
        direction: sort.direction,
        priority: sort.priority,
      })
    );

    // Reconstruct ViewType and ViewConfig value objects from serialized data
    // AIDEV-NOTE: Value objects don't survive client→server serialization,
    // so we need to reconstruct them on the server side
    let viewTypeVO: ViewType | undefined;
    let viewConfigVO: ViewConfig | undefined;

    if (viewType) {
      // viewType comes as a string or serialized object with _value property
      const typeValue = typeof viewType === 'string'
        ? viewType
        : (viewType as any)._value || viewType;
      viewTypeVO = ViewType.create(typeValue);
    }

    if (viewConfig) {
      // viewConfig comes as a plain object
      const configData = (viewConfig as any)._config || viewConfig;
      viewConfigVO = ViewConfig.fromJSON(configData);
    }

    const result = await dataSourceService.createView({
      tableId: TableId.fromNumber(tableId),
      organizationId: OrganizationId.fromNumber(currentOrg.id),
      name,
      description,
      createdBy: UserId.fromString(session.user.id),
      filters: filterVOs,
      sorting: sortingVOs,
      fieldMappings: fieldMappingVOs,
      viewType: viewTypeVO,
      viewConfig: viewConfigVO,
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
    const { id, name, description, filters, sorting, pagination, fieldMappings } = data;

    if (!id) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    await requireResourcePermission("data:manage", "view", id);
    await requireCurrentOrganization();

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

    // Fetch fields for filter field name conversion
    let fieldNameToIdMap: Map<string, number> | undefined;
    if (filters && filters.length > 0) {
      const { getFields } = await import('./fields');
      const fields = await getFields(dataSource.tableId.value);
      fieldNameToIdMap = new Map(fields.map(f => [f.name, f.id]));
    }

    // Update name/description if provided
    if (name !== undefined) {
      dataSource.updateName(name);
    }

    if (description !== undefined) {
      dataSource.updateDescription(description);
    }

    // Update filters if provided
    if (filters !== undefined && fieldNameToIdMap) {
      // Clear existing filters and add new ones
      dataSource.clearFilters();

      // Operator mapping (same as createView)
      const uiToDomainOperatorMap: Record<string, string> = {
        'eq': 'equals',
        'ne': 'not_equals',
        'ilike': 'contains',
        'like': 'contains',
        'gt': 'greater_than',
        'gte': 'greater_than_or_equal',
        'lt': 'less_than',
        'lte': 'less_than_or_equal',
        'is_null': 'is_empty',
        'is_not_null': 'is_not_empty',
      };

      for (const filter of filters) {
        const fieldId = fieldNameToIdMap.get(filter.field);
        if (!fieldId) {
          console.warn(`Field "${filter.field}" not found, skipping filter`);
          continue;
        }

        const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;

        dataSource.addFilter(
          FilterConfig.create({
            fieldId,
            operator: domainOperator as any,
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

    // Update field mappings if provided
    if (fieldMappings !== undefined) {
      // Convert plain objects to FieldMapping value objects
      const fieldMappingVOs = fieldMappings.map((mapping) =>
        FieldMapping.create({
          sourceFieldId: mapping.sourceFieldId,
          displayName: mapping.displayName,
          visible: mapping.visible,
          order: mapping.order,
        })
      );
      dataSource.setFieldMappings(fieldMappingVOs);
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
    if (!id) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    await requireResourcePermission("data:manage", "view", id);
    await requireCurrentOrganization();

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
    if (!id) {
      return null;
    }

    await requireResourcePermission("data:view", "view", id);
    await requireCurrentOrganization();

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

    // Fetch table names to enrich the DTOs
    const { getTables } = await import('./tables');
    const tables = await getTables();
    const tableNameMap = new Map(tables.map(t => [t.id, t.name]));

    return result.data.map((ds) => {
      const dto = ViewMapper.toDTO(ds);
      return {
        ...dto,
        tableName: tableNameMap.get(dto.tableId),
      };
    });
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
    if (!dataSourceId) {
      return null;
    }

    await requireResourcePermission("data:view", "view", dataSourceId);
    await requireCurrentOrganization();

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

    // Convert Row entities to plain objects with numeric field IDs as keys
    const plainRows = result.data.rows.map((row) => row.toPlainObject(fields));

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

/**
 * Execute aggregations for a metric/dashboard view
 *
 * AIDEV-NOTE: Used by MetricBlock and DashboardBlock to compute aggregations.
 * Aggregations are computed at the backend (Python/Polars via gRPC), never in Node.js/browser.
 * This follows Baserow's architecture pattern for backend aggregation computation.
 *
 * TODO-CACHING: Add caching layer with configurable TTL for aggregation results.
 * Cache key should include: viewId, filters, timestamp bucket (e.g., rounded to nearest 5 minutes).
 * Invalidate cache on data changes or manual refresh.
 */
export async function executeViewAggregations(
  viewId: number
): Promise<{
  results: Array<{
    fieldId: number;
    aggregationType: string;
    value: any;
    label?: string;
    formatType?: string;
  }>;
} | null> {
  try {
    if (!viewId) {
      return null;
    }

    await requireResourcePermission("data:view", "view", viewId);
    await requireCurrentOrganization();

    const viewService = getViewApplicationService();

    // Execute aggregations via application service
    const result = await viewService.executeAggregations({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute view aggregations:", result.error);
      return null;
    }

    return {
      results: result.data,
    };
  } catch (error) {
    console.error("Error executing view aggregations:", error);
    return null;
  }
}

/**
 * Execute a chart view and return data formatted for Recharts
 *
 * AIDEV-NOTE: Used by ChartBlock to fetch and render chart visualizations.
 * Handles both raw mode (plot table rows directly) and aggregated mode (GROUP BY with aggregations).
 */
export async function executeChartView(
  viewId: number
): Promise<{
  dataPoints: Array<{
    x: any;
    y: any;
    series?: string;
    [key: string]: any;
  }>;
  xAxisLabel?: string;
  yAxisLabels?: string[];
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  dataMode: 'raw' | 'aggregated';
} | null> {
  try {
    if (!viewId) {
      return null;
    }

    await requireResourcePermission("data:view", "view", viewId);
    await requireCurrentOrganization();

    const viewService = getViewApplicationService();

    // Execute chart view via application service
    const result = await viewService.executeChartView({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute chart view:", result.error);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("Error executing chart view:", error);
    return null;
  }
}

/**
 * Get form view configuration for rendering
 *
 * AIDEV-NOTE: Used by FormBlock to fetch form configuration and field definitions.
 * Returns all necessary data for client-side form rendering.
 */
export async function getFormViewConfiguration(
  viewId: number
): Promise<{
  viewName: string;
  viewDescription?: string;
  formConfig: any;
  tableFields: any[];
  tableId: number;
} | null> {
  try {
    if (!viewId) {
      return null;
    }

    await requireResourcePermission("data:view", "view", viewId);
    await requireCurrentOrganization();

    const viewService = getViewApplicationService();

    // Get form view configuration via application service
    const result = await viewService.getFormViewConfiguration({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to get form view configuration:", result.error);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error("Error getting form view configuration:", error);
    return null;
  }
}

/**
 * Submit a form view to create a new row
 *
 * AIDEV-NOTE: Used by FormBlock to submit form data and create new table rows.
 * Validates form data against form configuration before creating the row.
 *
 * @param viewId - Form view ID
 * @param formData - Submitted form data with field names as keys
 * @param revalidateUrl - Optional URL to revalidate after submission
 */
export async function submitFormView(
  viewId: number,
  formData: Record<string, any>,
  revalidateUrl?: string
): Promise<Result<{ rowId: string }>> {
  try {
    if (!viewId) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    // Need to view the form configuration
    await requireResourcePermission("data:view", "view", viewId);
    // Need create permission to create a new row
    const session = await requirePermission("data:create");
    await requireCurrentOrganization();

    if (!formData || Object.keys(formData).length === 0) {
      return {
        success: false,
        error: "Form data is required",
      };
    }

    const viewService = getViewApplicationService();

    // 1. Get form view configuration
    const configResult = await viewService.getFormViewConfiguration({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!configResult.success || !configResult.data) {
      return {
        success: false,
        error: configResult.error || "Failed to get form view configuration",
      };
    }

    const { formConfig, tableFields, tableId } = configResult.data;

    // 2. Validate required fields from form configuration
    // AIDEV-NOTE: Form configuration specifies which fields are required
    // We need to validate that all required fields have values
    const requiredFieldErrors: string[] = [];

    for (const page of formConfig.pages) {
      for (const fieldConfig of page.fields) {
        // Check if field is required (either in field config or in table field definition)
        const tableField = tableFields.find((f: any) => f.id === fieldConfig.fieldId);
        if (!tableField) continue;

        const isRequired = fieldConfig.required !== undefined
          ? fieldConfig.required
          : tableField.required;

        if (isRequired) {
          const fieldValue = formData[tableField.name];
          if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
            const label = fieldConfig.label || tableField.name;
            requiredFieldErrors.push(`${label} is required`);
          }
        }
      }
    }

    if (requiredFieldErrors.length > 0) {
      return {
        success: false,
        error: requiredFieldErrors.join(', '),
      };
    }

    // 3. Convert field names to field IDs for Row entity
    // AIDEV-NOTE: Form data comes with field names as keys: { name: "value", age: 123 }
    // But Row.fromPlainObject expects numeric field IDs: { 6: "value", 7: 123 }
    console.log('[submitFormView] tableFields count:', tableFields.length);
    console.log('[submitFormView] tableFields structure:', JSON.stringify(tableFields, null, 2));
    console.log('[submitFormView] formData keys:', Object.keys(formData));

    const convertedData: Record<string, any> = {};

    for (const field of tableFields) {
      console.log('[submitFormView] Processing field:', {
        id: field.id,
        name: field.name,
        type: field.type,
        required: field.required,
        hasIdProperty: 'id' in field,
        idType: typeof field.id,
        idValue: field.id,
      });

      if (field.id === undefined || field.id === null) {
        console.error('[submitFormView] ERROR: Field has undefined/null ID:', {
          field: field,
          fieldName: field.name,
          allFieldProperties: Object.keys(field),
        });
        continue; // Skip this field
      }

      const fieldKey = field.id.toString();
      console.log('[submitFormView] Field key conversion:', { fieldId: field.id, fieldKey, fieldName: field.name });

      if (formData[field.name] !== undefined) {
        convertedData[fieldKey] = formData[field.name];
        console.log('[submitFormView] Added to convertedData:', { fieldKey, value: formData[field.name] });
      }
    }

    console.log('[submitFormView] Final convertedData:', convertedData);

    // 4. Create Row entity from converted data
    const { Row } = await import("@/ddd/domain/tables/value-objects/row");
    const row = Row.fromPlainObject(convertedData, tableId, tableFields);

    // 5. Create row via table application service
    const tableAppService = (await import("@/ddd/application/di/container")).getTableApplicationService();

    const createResult = await tableAppService.createRow({
      tableId: TableId.fromNumber(tableId),
      data: row,
      createdBy: UserId.fromString(session.user.id),
    });

    if (!createResult.success || !createResult.data) {
      return {
        success: false,
        error: createResult.error || "Failed to create row",
      };
    }

    // 6. Revalidate path if provided
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath("/data");
    }

    return {
      success: true,
      data: {
        rowId: createResult.data.id.value,
      },
    };
  } catch (error) {
    console.error("Error submitting form view:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit form",
    };
  }
}
