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
import { requirePermission, requireResourcePermission, getSessionSafe } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getViewApplicationService, getFileApplicationService, getAuditApplicationService } from "@/ddd/application/di/container";
import { OrganizationId, TableId, UserId, FieldId } from "@/ddd/domain/shared/value-objects";
import type { FileFieldValue } from "@/ddd/domain/tables/value-objects/field-values";
import { ViewId } from "@/ddd/domain/views/value-objects/view-id";
import { FilterConfig } from "@/ddd/domain/views/value-objects/filter-config";
import { SortConfig } from "@/ddd/domain/views/value-objects/sort-config";
import { PaginationConfig } from "@/ddd/domain/views/value-objects/pagination-config";
import { FieldMapping } from "@/ddd/domain/views/value-objects/field-mapping";
import { ViewType } from "@/ddd/domain/views/value-objects/view-type";
import { ViewConfig } from "@/ddd/domain/views/value-objects/view-config";
import { ViewMapper, type ViewDTO } from "@/app/mappers/view-mapper";
import { FieldMapper, type FieldDTO } from "@/app/mappers/field-mapper";
import type { Result, CreateViewData, UpdateViewData } from "./types";
import { getCacheService, CACHE_KEYS, CACHE_TAGS } from "@/lib/cache";

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
    const session = await requirePermission("view:create");
    const currentOrg = await requireCurrentOrganization();

    const { tableId, name, description, requiresAuth, fieldMappings, filters, sorting, viewType, viewConfig } = data;

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
      'in': 'in',
      'not_in': 'not_in',
    };

    // Operators that don't take a value
    const noValueOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];

    const filterVOs = filters?.map((filter) => {
      const fieldId = fieldNameToIdMap.get(filter.field);
      if (!fieldId) {
        throw new Error(`Field "${filter.field}" not found in table`);
      }

      const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;
      // Clear value for no-value operators
      const filterValue = noValueOperators.includes(domainOperator) ? undefined : filter.value;

      return FilterConfig.create({
        fieldId,
        operator: domainOperator as any,
        value: filterValue,
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
      requiresAuth: requiresAuth ?? true, // Secure by default
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

    // AUDIT: Log view creation
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'view_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'view',
        resourceId: String(result.data.id.value),
        resourceName: result.data.name,
        parentResourceType: 'table',
        parentResourceId: String(tableId),
        eventData: { viewType: viewType?.toString(), requiresAuth },
        success: true,
      }
    );

    // Only revalidate if explicitly requested (prevents unwanted page reloads)
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
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
    const { id, name, description, requiresAuth, filters, sorting, pagination, fieldMappings, viewConfig } = data;

    if (!id) {
      return {
        success: false,
        error: "View ID is required",
      };
    }

    const session = await requireResourcePermission("view:manage", "view", id);
    const currentOrg = await requireCurrentOrganization();

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

    // Update requiresAuth if provided
    if (requiresAuth !== undefined) {
      dataSource.updateRequiresAuth(requiresAuth);
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
        'in': 'in',
        'not_in': 'not_in',
      };

      // Operators that don't take a value
      const noValueOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];

      for (const filter of filters) {
        const fieldId = fieldNameToIdMap.get(filter.field);
        if (!fieldId) {
          console.warn(`Field "${filter.field}" not found, skipping filter`);
          continue;
        }

        const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;
        // Clear value for no-value operators
        const filterValue = noValueOperators.includes(domainOperator) ? undefined : filter.value;

        dataSource.addFilter(
          FilterConfig.create({
            fieldId,
            operator: domainOperator as any,
            value: filterValue,
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

    // Update viewConfig if provided (used by form config editor)
    if (viewConfig !== undefined) {
      const newConfig = ViewConfig.fromJSON(viewConfig as any);
      dataSource.updateViewConfig(newConfig);
    }

    // Get the repository to save directly
    const dataSourceRepository = (dataSourceService as any).dataSourceRepository;
    const savedView = await dataSourceRepository.save(dataSource);

    // AUDIT: Log view update
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'view_crud',
        eventAction: 'update',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'view',
        resourceId: String(id),
        resourceName: savedView.name,
        parentResourceType: 'table',
        parentResourceId: String(savedView.tableId.value),
        eventData: { updatedFields: Object.keys(data).filter(k => k !== 'id') },
        success: true,
      }
    );

    // Only revalidate if explicitly requested (prevents unwanted page reloads)
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
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

    const session = await requireResourcePermission("view:manage", "view", id);
    const currentOrg = await requireCurrentOrganization();

    const dataSourceService = getViewApplicationService();

    // AUDIT: Get view info BEFORE deletion
    const viewResult = await dataSourceService.getView(ViewId.fromNumber(id));
    const viewName = viewResult.data?.name;
    const tableId = viewResult.data?.tableId.value;

    const result = await dataSourceService.deleteView(
      ViewId.fromNumber(id)
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete view",
      };
    }

    // AUDIT: Log view deletion
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'view_crud',
        eventAction: 'delete',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'view',
        resourceId: String(id),
        resourceName: viewName,
        parentResourceType: 'table',
        parentResourceId: tableId ? String(tableId) : undefined,
        eventData: {},
        success: true,
      }
    );

    // Only revalidate if explicitly requested (prevents unwanted page reloads)
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
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
 *
 * AIDEV-NOTE: Supports public views via auth-first pattern.
 * - If authenticated: use normal RLS-wrapped path with permission check
 * - If unauthenticated: only allow public views (requiresAuth=false)
 */
export async function getView(id: number): Promise<ViewDTO | null> {
  try {
    if (!id) {
      return null;
    }

    const dataSourceService = getViewApplicationService();
    const session = await getSessionSafe();

    if (session) {
      // Authenticated user: use normal RLS-wrapped path
      await requireResourcePermission("view:manage", "view", id);
      const result = await dataSourceService.getView(ViewId.fromNumber(id));
      if (!result.success || !result.data) {
        return null;
      }
      return ViewMapper.toDTO(result.data);
    } else {
      // Unauthenticated: only allow public views
      const publicResult = await dataSourceService.getPublicView(ViewId.fromNumber(id));
      if (!publicResult.success || !publicResult.data) {
        return null;
      }
      return ViewMapper.toDTO(publicResult.data);
    }
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
    await requirePermission("database:view");
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
    await requirePermission("database:view");
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
 * Substitutes page variable placeholders in filter values
 *
 * @param value - Filter value that may contain {{params.varName}} placeholders
 * @param context - Context containing params from URL query parameters
 * @returns Value with variables substituted
 *
 * @example
 * substituteVariables("{{params.product_id}}", { product_id: "123" }) // returns "123"
 * substituteVariables("static_value", { product_id: "123" }) // returns "static_value"
 */
function substituteFilterVariable(
  value: string | number | boolean | null | undefined,
  context?: import('@/components/puck/types/puck-context').PuckResolveContext
): string | number | boolean | null | undefined {
  if (typeof value !== 'string') {
    return value;
  }

  // Match {{params.varName}} pattern (double braces)
  const paramMatch = value.match(/^\{\{params\.(\w+)\}\}$/);
  if (paramMatch && context) {
    const paramName = paramMatch[1];
    const paramValue = context[paramName];
    if (paramValue !== undefined) {
      // Return the param value, handling arrays by taking first element
      if (Array.isArray(paramValue)) {
        return paramValue[0] ?? '';
      }
      return paramValue;
    }
    // Variable not found in context - return empty string to avoid matching everything
    return '';
  }

  // For partial substitutions (e.g., "prefix_{{params.id}}_suffix"), do inline replacement
  if (value.includes('{{params.') && context) {
    return value.replace(/\{\{params\.(\w+)\}\}/g, (_, name) => {
      const paramValue = context[name];
      return paramValue !== undefined ? String(paramValue) : '';
    });
  }

  return value;
}

/**
 * Filter schema fields and row data to only include view-visible fields.
 * When a view has fieldMappings configured, only fields marked visible are returned.
 * No mappings = view not configured yet, return everything.
 */
function filterByViewMappings(
  fields: FieldDTO[],
  rows: Array<Record<string, unknown>>,
  fieldMappings: ReadonlyArray<{ sourceFieldId: number; visible: boolean }>,
): { fields: FieldDTO[]; rows: Array<Record<string, unknown>> } {
  if (!fieldMappings.length) return { fields, rows };

  const visibleFieldIds = new Set(
    fieldMappings.filter(m => m.visible).map(m => m.sourceFieldId)
  );

  const filteredFields = fields.filter(f => visibleFieldIds.has(f.id));

  // Build allowed keys: "id" (row primary key) + numeric field IDs + field names
  const allowedKeys = new Set<string>(['id']);
  for (const f of filteredFields) {
    allowedKeys.add(String(f.id));
    allowedKeys.add(f.name);
  }

  const filteredRows = rows.map(row => {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (allowedKeys.has(key)) filtered[key] = value;
    }
    return filtered;
  });

  return { fields: filteredFields, rows: filteredRows };
}

/**
 * Execute a view and return rows as DTOs
 *
 * AIDEV-NOTE: Supports public views via auth-first pattern.
 * - If authenticated: use normal RLS-wrapped path with permission check
 * - If unauthenticated: only allow public views (requiresAuth=false)
 *
 * @param dataSourceId - The view ID to execute
 * @param context - Optional context for dynamic filtering (query params, etc.)
 *                  Variables like {params.product_id} are substituted from context
 * @param pagination - Optional pagination override (pageSize and offset)
 * @param additionalFilters - Optional runtime filters with variable substitution support
 */
export async function executeView(
  dataSourceId: number,
  context?: import('@/components/puck/types/puck-context').PuckResolveContext,
  pagination?: { pageSize: number; offset: number },
  additionalFilters?: Array<{ field: string; operator: string; value: any }>
): Promise<{
  rows: Array<Record<string, any>>;
  fields: FieldDTO[];
  totalCount: number;
  pageSize: number;
  offset: number;
} | null> {
  try {
    if (!dataSourceId) {
      return null;
    }

    const dataSourceService = getViewApplicationService();
    const session = await getSessionSafe();

    // Get view using appropriate method based on auth state
    let view;
    let isPublicAccess = false;

    if (session) {
      // Authenticated user: use normal RLS-wrapped path
      await requireResourcePermission("view:view", "view", dataSourceId);
      await requireCurrentOrganization();
      const viewResult = await dataSourceService.getView(ViewId.fromNumber(dataSourceId));
      if (!viewResult.success || !viewResult.data) {
        console.error("Failed to get view:", viewResult.error);
        return null;
      }
      view = viewResult.data;
    } else {
      // Unauthenticated: only allow public views
      const publicResult = await dataSourceService.getPublicView(ViewId.fromNumber(dataSourceId));
      if (!publicResult.success || !publicResult.data) {
        console.error("Failed to get public view:", publicResult.error);
        return null;
      }
      view = publicResult.data;
      isPublicAccess = true;
    }

    // Build additional filter configs if provided
    let runtimeFilters: FilterConfig[] | undefined;
    let rowIdFilter: { operator: 'eq' | 'ne'; value: string } | undefined;

    if (additionalFilters && additionalFilters.length > 0) {
      // Fetch fields to convert field names to IDs
      // Pass viaViewId for public access (allows getFields to work without auth)
      const { getFields } = await import('./fields');
      const fields = await getFields(view.tableId.value, isPublicAccess ? { viaViewId: dataSourceId } : undefined);
      const fieldNameToIdMap = new Map(fields.map(f => [f.name, f.id]));

      // Operator mapping (same as createView/updateView)
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
        'in': 'in',
        'not_in': 'not_in',
      };

      // Operators that don't take a value
      const noValueOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false'];

      runtimeFilters = [];
      for (const filter of additionalFilters) {
        // Skip state variables - they need client-side resolution
        if (typeof filter.value === 'string' && filter.value.includes('{{state.')) {
          console.log(`[executeView] Skipping state variable filter for field "${filter.field}" - needs client-side resolution`);
          continue;
        }

        const domainOperator = uiToDomainOperatorMap[filter.operator] || filter.operator;

        // Substitute params variables in the filter value
        const substitutedValue = substituteFilterVariable(filter.value, context);

        // Skip filters where variable wasn't found (empty string) - but not for no-value operators
        if (substitutedValue === '' && !noValueOperators.includes(domainOperator)) {
          console.warn(`Variable in filter for field "${filter.field}" not found in context, skipping`);
          continue;
        }

        // Handle 'id' field specially - bypass FilterConfig (which requires fieldId > 0)
        // The synthetic 'id' field has fieldId=0, so we use rowIdFilter instead
        if (filter.field === 'id') {
          const op = filter.operator === 'ne' ? 'ne' : 'eq';
          rowIdFilter = { operator: op, value: String(substitutedValue) };
          continue;
        }

        const fieldId = fieldNameToIdMap.get(filter.field);
        if (fieldId === undefined) {
          console.warn(`Field "${filter.field}" not found, skipping filter`);
          continue;
        }

        // Clear value for no-value operators
        const filterValue = noValueOperators.includes(domainOperator) ? undefined : substitutedValue;

        runtimeFilters.push(
          FilterConfig.create({
            fieldId,
            operator: domainOperator as any,
            value: filterValue,
          })
        );
      }
    }

    // Execute the view with optional pagination override and runtime filters
    const result = await dataSourceService.executeView({
      dataSourceId: ViewId.fromNumber(dataSourceId),
      overridePagination: pagination
        ? PaginationConfig.create(pagination)
        : undefined,
      additionalFilters: runtimeFilters,
      rowIdFilter,
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute view:", result.error);
      return null;
    }

    // Get the schema using appropriate method based on auth state
    let schemaFields;
    if (isPublicAccess) {
      const schemaResult = await dataSourceService.getPublicViewSchema(
        ViewId.fromNumber(dataSourceId)
      );
      if (!schemaResult.success || !schemaResult.data) {
        console.error("Failed to get public view schema:", schemaResult.error);
        return null;
      }
      schemaFields = schemaResult.data;
    } else {
      const schemaResult = await dataSourceService.getViewSchema(
        ViewId.fromNumber(dataSourceId)
      );
      if (!schemaResult.success || !schemaResult.data) {
        console.error("Failed to get view schema:", schemaResult.error);
        return null;
      }
      schemaFields = schemaResult.data;
    }

    // Type-narrow the schema fields after null check
    const fields = schemaFields;

    // Convert Row entities to plain objects with field IDs as keys
    // (useFieldValue looks up by fieldId, e.g., rowData["42"])
    const plainRows = result.data.rows.map((row) => row.toPlainObject(fields));

    // Convert TableField VOs to full FieldDTOs (preserves all metadata)
    const plainFields = fields.map((field) => FieldMapper.toDTO(field));

    // Filter to only view-visible fields before returning to client
    const { fields: filteredFields, rows: filteredRows } = filterByViewMappings(
      plainFields, plainRows, view.fieldMappings
    );

    return {
      rows: filteredRows,
      fields: filteredFields,
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
 * CACHING: Results are cached for 5 minutes. Cache is invalidated on:
 * - Row mutations (via table stats tag)
 * - View configuration changes (via view tag)
 */
export async function executeViewAggregations(
  viewId: number,
  options?: { skipCache?: boolean }
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

    await requireResourcePermission("view:view", "view", viewId);
    await requireCurrentOrganization();

    const viewService = getViewApplicationService();
    const cacheService = getCacheService();

    // Get view to determine tableId for cache tagging
    const viewResult = await viewService.getView(ViewId.fromNumber(viewId));
    const tableId = viewResult.success && viewResult.data
      ? viewResult.data.tableId.value
      : 0;

    const cacheConfig = CACHE_KEYS.viewAggregations(viewId, tableId);

    // Check cache first (unless skipCache is true)
    if (!options?.skipCache && cacheService.isConnected()) {
      const cached = await cacheService.get<{
        results: Array<{
          fieldId: number;
          aggregationType: string;
          value: any;
          label?: string;
          formatType?: string;
        }>;
      }>(cacheConfig.key);

      if (cached) {
        console.log(`[Cache] Hit for view aggregations: ${viewId}`);
        return cached;
      }
    }

    // Execute aggregations via application service
    const result = await viewService.executeAggregations({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute view aggregations:", result.error);
      return null;
    }

    const response = {
      results: result.data,
    };

    // Cache the result
    if (cacheService.isConnected()) {
      await cacheService.set(cacheConfig.key, response, {
        ttlSeconds: cacheConfig.ttl,
        tags: cacheConfig.tags,
      });
      console.log(`[Cache] Stored view aggregations: ${viewId}`);
    }

    return response;
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
 *
 * CACHING: Results are cached for 5 minutes. Cache is invalidated on:
 * - Row mutations (via table stats tag)
 * - View configuration changes (via view tag)
 */
export async function executeChartView(
  viewId: number,
  options?: { skipCache?: boolean }
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

    await requireResourcePermission("view:view", "view", viewId);
    await requireCurrentOrganization();

    const viewService = getViewApplicationService();
    const cacheService = getCacheService();

    // Get view to determine tableId for cache tagging
    const viewResult = await viewService.getView(ViewId.fromNumber(viewId));
    const tableId = viewResult.success && viewResult.data
      ? viewResult.data.tableId.value
      : 0;

    const cacheConfig = CACHE_KEYS.chartViewData(viewId, tableId);

    // Check cache first (unless skipCache is true)
    if (!options?.skipCache && cacheService.isConnected()) {
      type ChartViewResult = {
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
      };

      const cached = await cacheService.get<ChartViewResult>(cacheConfig.key);

      if (cached) {
        console.log(`[Cache] Hit for chart view: ${viewId}`);
        return cached;
      }
    }

    // Execute chart view via application service
    const result = await viewService.executeChartView({
      viewId: ViewId.fromNumber(viewId),
    });

    if (!result.success || !result.data) {
      console.error("Failed to execute chart view:", result.error);
      return null;
    }

    // Cache the result
    if (cacheService.isConnected()) {
      await cacheService.set(cacheConfig.key, result.data, {
        ttlSeconds: cacheConfig.ttl,
        tags: cacheConfig.tags,
      });
      console.log(`[Cache] Stored chart view: ${viewId}`);
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

    await requireResourcePermission("view:view", "view", viewId);
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
    await requireResourcePermission("view:view", "view", viewId);
    // Need create permission to create a new row
    const session = await requirePermission("table:create");
    const currentOrg = await requireCurrentOrganization();

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

    // 3.5. Upload files for file/document fields and replace with FileFieldValue
    const fileApplicationService = getFileApplicationService();

    for (const field of tableFields) {
      const fieldKey = field.id.toString();
      const value = convertedData[fieldKey];

      // Check if this is a file field with File objects
      if ((field.type === 'file' || field.type === 'document') && value) {
        // Handle single File or array of Files
        const files = Array.isArray(value) ? value : [value];
        const fileValues: FileFieldValue[] = [];

        for (const file of files) {
          if (file instanceof File) {
            const buffer = Buffer.from(await file.arrayBuffer());

            const uploadResult = await fileApplicationService.uploadFile({
              organizationId: OrganizationId.fromNumber(currentOrg.id),
              tableId: TableId.fromNumber(tableId),
              fieldId: FieldId.fromNumber(field.id),
              file: {
                buffer,
                filename: file.name,
                mimeType: file.type,
              },
            });

            if (uploadResult.success && uploadResult.data) {
              fileValues.push(uploadResult.data);
            } else {
              console.error(`Failed to upload file ${file.name}:`, uploadResult.error);
              return {
                success: false,
                error: `Failed to upload file: ${file.name}`,
              };
            }
          } else if (typeof file === 'object' && file !== null && 's3Key' in file) {
            // Already a FileFieldValue (shouldn't happen in form submit, but handle gracefully)
            fileValues.push(file as FileFieldValue);
          }
        }

        // Replace File objects with FileFieldValue array
        convertedData[fieldKey] = fileValues;
      }
    }

    // 4. Create Row entity from converted data
    const { Row } = await import("@/ddd/domain/tables/value-objects/row");
    const row = Row.fromPlainObject(convertedData, tableId, tableFields);

    // 5. Create row via row application service
    const rowAppService = (await import("@/ddd/application/di/container")).getRowApplicationService();

    const createResult = await rowAppService.createRow({
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

/**
 * Update form view configuration
 *
 * AIDEV-NOTE: Used by FormConfigFieldRenderer in the Puck sidebar to persist
 * form configuration changes (field ordering, page management, field settings).
 */
export async function updateFormViewConfig(
  viewId: number,
  formConfig: {
    pages: Array<{
      id: string;
      title?: string;
      description?: string;
      fields: Array<{
        fieldId: number;
        order: number;
        label?: string;
        helpText?: string;
        placeholder?: string;
        required?: boolean;
        visible?: boolean;
        conditionalVisibility?: {
          dependsOn: number;
          operator: 'equals' | 'not_equals' | 'is_empty' | 'is_not_empty' | 'contains';
          value?: any;
        };
        validationRules?: Array<{ type: 'min' | 'max' | 'pattern' | 'min_length' | 'max_length' | 'email' | 'url' | 'required'; value?: any; message: string }>;
        allowMultiple?: boolean;
        maxFiles?: number;
      }>;
      order: number;
    }>;
    submitButtonText?: string;
    successMessage?: string;
    redirectUrl?: string;
  }
): Promise<Result<ViewDTO>> {
  try {
    if (!viewId) {
      return { success: false, error: "View ID is required" };
    }

    const session = await requireResourcePermission("view:manage", "view", viewId);
    const currentOrg = await requireCurrentOrganization();

    const viewService = getViewApplicationService();

    const existingResult = await viewService.getView(ViewId.fromNumber(viewId));
    if (!existingResult.success || !existingResult.data) {
      return { success: false, error: "View not found" };
    }

    const view = existingResult.data;

    // Build and apply the new form config
    const newConfig = ViewConfig.createForm(formConfig as any);
    view.updateViewConfig(newConfig);

    // Save
    const dataSourceRepository = (viewService as any).dataSourceRepository;
    const savedView = await dataSourceRepository.save(view);

    // Audit log
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'database',
        eventCategory: 'view_crud',
        eventAction: 'update',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'view',
        resourceId: String(viewId),
        resourceName: savedView.name,
        parentResourceType: 'table',
        parentResourceId: String(savedView.tableId.value),
        eventData: { updatedFields: ['formConfig'] },
        success: true,
      }
    );

    return {
      success: true,
      data: ViewMapper.toDTO(savedView),
    };
  } catch (error) {
    console.error("Error updating form view config:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update form configuration",
    };
  }
}
