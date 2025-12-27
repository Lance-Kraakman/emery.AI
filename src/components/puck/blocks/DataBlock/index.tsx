/**
 * DataBlock - Puck Component Configuration
 *
 * Unified data block that replaces DataContextBlock and RepeatBlock.
 * Supports two modes:
 * - single: Single record context (detail pages) - uses filter to select row
 * - list: Repeating items with layout options (list/grid)
 *
 * Flow:
 * 1. User selects a view and mode in Puck editor
 * 2. For single mode: user configures filter to select row (e.g., id = {params.product_id})
 * 3. resolveData fetches data with backend filtering and field metadata
 * 4. DataBlock provides DataLayoutContext (fields) + RowDataContext (data) to children
 * 5. Child field blocks use useDataLayoutContext for field selection
 * 6. Child field blocks use useRowData for data access
 *
 * Single Mode Row Selection:
 * - Uses filter-based approach: user defines a filter like "id equals {params.product_id}"
 * - Variables like {params.varName} are substituted from URL query parameters
 * - Static values work too: "id equals 123"
 * - Filtering happens at database level for efficiency
 *
 * Template Editing:
 * - Uses Puck's native slot system for inline editing
 * - Field components (TextField, NumberField, etc.) are only visible in this slot
 * - At runtime, slot content is iterated with Render for list mode
 */

import type { ComponentConfig } from "@measured/puck";
import DataBlock, { type DataBlockProps } from "./DataBlock";
import { executeView, getView } from "@/app/actions/views";
import { executePublicView } from "@/app/actions/public-pages";
import { getFields } from "@/app/actions/fields";
import { isPuckResolveContext } from "../../types/puck-context";
import { createViewManagementField } from "../../custom-fields";
import { MultiFilterField, type RowFilterConfig } from "../../fields/MultiFilterField";
import { MultiSortField, type RowSortConfig } from "../../fields/MultiSortField";
import { FIELD_BLOCK_TYPES } from "../../constants";

export const DataBlockConfig: ComponentConfig<DataBlockProps> = {
  label: "Data",

  fields: {
    // Mode selection
    mode: {
      type: "radio",
      label: "Mode",
      options: [
        { label: "Single Record", value: "single" },
        { label: "List / Grid", value: "list" },
      ],
    },

    // View Selection
    viewId: createViewManagementField({
      supportedViewTypes: ['grid'],
      label: 'Data Source (Grid View)',
    }),

    // NOTE: singleRowFilter is dynamically created in resolveFields
    // to capture viewId in a closure for the custom field render

    // List mode: Layout
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Vertical (Stack)", value: "vertical" },
        { label: "Grid", value: "grid" },
        { label: "Horizontal (Carousel)", value: "horizontal" },
      ],
    },

    // List mode: Grid columns
    columns: {
      type: "number",
      label: "Columns",
      min: 1,
      max: 6,
    },

    // List mode: Gap (spacing level)
    gap: {
      type: "select",
      label: "Gap",
      options: [
        { value: "0", label: "None (0)" },
        { value: "1", label: "XS (1)" },
        { value: "2", label: "SM (2)" },
        { value: "3", label: "MD (3)" },
        { value: "4", label: "Base (4)" },
        { value: "5", label: "LG (5)" },
        { value: "6", label: "XL (6)" },
        { value: "7", label: "2XL (7)" },
        { value: "8", label: "3XL (8)" },
        { value: "9", label: "4XL (9)" },
        { value: "10", label: "5XL (10)" },
      ],
    },

    // List mode: Items per page
    itemsPerPage: {
      type: "number",
      label: "Items Per Page",
      min: 1,
      max: 100,
    },

    // List mode: Pagination style
    paginationStyle: {
      type: "radio",
      label: "Pagination",
      options: [
        { label: "None", value: "none" },
        { label: "Load More", value: "load-more" },
        { label: "Page Numbers", value: "pages" },
      ],
    },

    // List mode: Max height for scroll container
    maxHeight: {
      type: "number",
      label: "Max Height (px)",
      min: 100,
    },

    // List mode: Carousel arrows (horizontal layout)
    showCarouselArrows: {
      type: "radio",
      label: "Show Carousel Arrows",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    // Edit mode options
    editEnabled: {
      type: "radio",
      label: "Enable Editing",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    allowCreate: {
      type: "radio",
      label: "Allow Creating New Rows",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    // Template slot - uses Puck's native slot system for inline editing
    // Field components (TextField, NumberField, etc.) are allowed here but hidden from root picker
    children: {
      type: "slot",
      // Allow field components plus common layout/content components
      allow: [
        // Field components (hidden from root, visible only in this slot)
        ...FIELD_BLOCK_TYPES,
        // Common layout components
        "Container", "Flex", "Grid", "Space", "Divider",
        // Content components
        "Text", "Heading", "Button", "LinkBlock",
        // Other useful components
        "ConditionalBlock",
      ],
    },

    // Hidden fields populated by resolveData
    _viewName: { type: "text", label: "View Name", visible: false },
    _tableId: { type: "number", label: "Table ID", visible: false },
    _error: { type: "text", label: "Error", visible: false },
  },

  defaultProps: {
    mode: "single",
    rowFilter: {
      conditions: [{
        id: crypto.randomUUID(),
        field: "id",
        operator: "eq",
        valueType: "variable",
        value: "{params.id}",
      }],
      logic: "and",
    },
    sortConfig: {
      conditions: [],
      dynamicField: undefined,
      dynamicDirection: undefined,
    },
    layout: "vertical",
    columns: 2,
    gap: "4",
    itemsPerPage: 10,
    paginationStyle: "none",
    showCarouselArrows: false,
    editEnabled: false,
    allowCreate: false,
    // children slot defaults to empty array
  },

  /**
   * Conditional field visibility based on mode
   * Dynamically creates rowFilter field with viewId in closure
   */
  resolveFields: (data, { fields }) => {
    const mode = data.props.mode;
    const layout = data.props.layout;
    const viewId = data.props.viewId;
    const editEnabled = data.props.editEnabled;

    // Base fields always shown
    const baseFields = {
      mode: fields.mode,
      viewId: fields.viewId,
    };

    // Row filter field - shown for both single and list modes
    // Get fields from resolved data (available after resolveData runs)
    const _fields = data.props._fields || [];

    const rowFilterField = {
      rowFilter: {
        type: "custom" as const,
        label: "Row Filter",
        render: ({ value, onChange }: { value: RowFilterConfig | undefined; onChange: (v: RowFilterConfig) => void }) => (
          <MultiFilterField
            key={viewId}  // Force remount when viewId changes
            value={value}
            onChange={onChange}
            viewId={viewId}
            parentFields={_fields}
          />
        ),
      },
    };

    // Sort config field - shown for list mode only
    const sortConfigField = {
      sortConfig: {
        type: "custom" as const,
        label: "Sort",
        render: ({ value, onChange }: { value: RowSortConfig | undefined; onChange: (v: RowSortConfig) => void }) => (
          <MultiSortField
            key={viewId}  // Force remount when viewId changes
            value={value}
            onChange={onChange}
            viewId={viewId}
          />
        ),
      },
    };

    // Template slot field - uses Puck's native slot for inline editing
    // Allow field components that are hidden from root picker
    const childrenField = {
      children: {
        type: "slot" as const,
        allow: [
          // Field components (hidden from root, visible only in this slot)
          ...FIELD_BLOCK_TYPES,
          // Common layout components
          "Container", "Flex", "Grid", "Space", "Divider",
          // Content components
          "Text", "Heading", "Button", "LinkBlock",
          // Other useful components
          "ConditionalBlock",
        ],
      },
    };

    // Edit mode fields (shown when viewId is selected)
    const editFields = viewId ? {
      editEnabled: fields.editEnabled,
      ...(editEnabled && mode === 'list' && { allowCreate: fields.allowCreate }),
    } : {};

    if (mode === 'single') {
      // Single mode: just filter and template slot
      return {
        ...baseFields,
        ...rowFilterField,
        ...editFields,
        ...childrenField,
      };
    }

    // List mode fields
    return {
      ...baseFields,
      ...rowFilterField,
      ...sortConfigField,
      layout: fields.layout,
      ...(layout === 'grid' && { columns: fields.columns }),
      gap: fields.gap,
      itemsPerPage: fields.itemsPerPage,
      paginationStyle: fields.paginationStyle,
      maxHeight: fields.maxHeight,
      ...(layout === 'horizontal' && { showCarouselArrows: fields.showCarouselArrows }),
      ...editFields,
      ...childrenField,
    };
  },

  /**
   * Server-side data resolution
   * Fetches data and field metadata from the selected view
   *
   * Single mode: Uses filter-based row selection with variable substitution
   * - Filter is passed to executeView with context for {params.x} substitution
   * - Filtering happens at database level for efficiency
   *
   * Public page support:
   * - When metadata.isPublicPage is true, uses executePublicView (no auth required)
   * - metadata.pageId must be provided for public page validation
   */
  resolveData: async ({ props }, { metadata }) => {
    // No view selected
    if (!props.viewId || isNaN(props.viewId)) {
      return {
        props: {
          ...props,
          _viewName: undefined,
          _tableId: undefined,
          _fields: [],
          _rows: [],
          _resolvedRow: undefined,
          _totalCount: 0,
          _error: undefined,
        },
      };
    }

    try {
      // Check if we're in a public page context
      const context = isPuckResolveContext(metadata) ? metadata : undefined;
      const isPublicPage = context?.isPublicPage === true;
      const pageId = context?.pageId as number | undefined;

      // Get view details for tableId
      const view = await getView(props.viewId);
      if (!view) {
        console.error('[DataBlock.resolveData] Failed to get view');
        return {
          props: {
            ...props,
            _error: 'Failed to load view',
          },
        };
      }

      // Get all table fields (for full FieldDTO data needed by edit mode)
      // Pass viewId so RLS can check public access via fields_public_via_view policy
      const allTableFields = await getFields(view.tableId, { viaViewId: props.viewId });

      // Helper to filter fields to only those mapped in the view
      const filterFieldsToView = (
        tableFields: typeof allTableFields,
        viewFields: Array<{ id: number; name: string; type: string }>
      ) => {
        const viewFieldIds = new Set(viewFields.map(f => f.id));
        return tableFields.filter(f => viewFieldIds.has(f.id));
      };

      // Helper to execute view (uses public or authenticated based on context)
      const doExecuteView = async (
        pagination: { pageSize: number; offset: number },
        additionalFilters?: Array<{ field: string; operator: string; value: unknown }>
      ) => {
        if (isPublicPage && pageId) {
          // Public page context - use public execution (no auth required)
          return executePublicView(
            props.viewId!,
            pageId,
            context,
            pagination,
            additionalFilters
          );
        } else {
          // Editor/preview context - use authenticated execution
          return executeView(
            props.viewId!,
            context,
            pagination,
            additionalFilters
          );
        }
      };

      // ============================================
      // BUILD FILTERS FROM RowFilterConfig
      // ============================================
      // Helper to build additionalFilters from RowFilterConfig
      // Skips conditions with {rowData.} pattern (handled client-side)
      const buildAdditionalFilters = (filterConfig?: RowFilterConfig) => {
        if (!filterConfig?.conditions?.length) return undefined;

        const filters: Array<{ field: string; operator: string; value: unknown }> = [];
        for (const condition of filterConfig.conditions) {
          // Skip empty conditions
          if (!condition.field || !condition.value) continue;

          // Skip rowData variables (need client-side resolution)
          if (typeof condition.value === 'string' && condition.value.includes('{rowData.')) {
            continue;
          }

          filters.push({
            field: condition.field,
            operator: condition.operator || 'eq',
            value: condition.value,
          });
        }

        return filters.length > 0 ? filters : undefined;
      };

      // ============================================
      // SINGLE MODE: Filter-based row selection
      // ============================================
      if (props.mode === 'single') {
        const filterConfig = props.rowFilter;

        // Validate filter configuration - need at least one complete condition
        const hasValidCondition = filterConfig?.conditions?.some(c => c.field && c.value);
        if (!hasValidCondition) {
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: allTableFields, // Use all fields when no filter (editor needs field options)
              _resolvedRow: undefined,
              _error: undefined, // No error, just not configured yet
            },
          };
        }

        // Build filters from conditions (skips rowData variables)
        const additionalFilters = buildAdditionalFilters(filterConfig);

        // Execute view with filter - fetch only 1 row
        // TODO: Pass filterConfig.logic for AND/OR support when backend supports it
        const result = await doExecuteView(
          { pageSize: 1, offset: 0 },
          additionalFilters
        );

        if (!result) {
          console.error('[DataBlock.resolveData] Failed to execute view for single mode');
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: allTableFields,
              _resolvedRow: undefined,
              _error: 'Failed to execute view',
            },
          };
        }

        // Filter fields to only those configured in the view
        const viewFields = filterFieldsToView(allTableFields, result.fields);

        // Get the first (and only) row
        const targetRow = result.rows[0];

        if (!targetRow) {
          // No row found - could be because variable wasn't in context (editor mode)
          // or the filter genuinely matched nothing
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: viewFields,
              _resolvedRow: undefined,
              _error: undefined, // Don't show error in editor when variable isn't available
            },
          };
        }

        return {
          props: {
            ...props,
            _viewName: view.name,
            _tableId: view.tableId,
            _fields: viewFields,
            _resolvedRow: targetRow,
            _error: undefined,
          },
        };
      }

      // ============================================
      // LIST MODE: Return paginated rows with optional filter
      // ============================================
      const pageSize = props.itemsPerPage || 10;

      // Build filters from rowFilter config (skips rowData variables)
      const additionalFilters = buildAdditionalFilters(props.rowFilter);

      // TODO: Pass props.rowFilter.logic for AND/OR support when backend supports it
      const result = await doExecuteView({ pageSize, offset: 0 }, additionalFilters);

      if (!result) {
        console.error('[DataBlock.resolveData] Failed to execute view for list mode');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _tableId: view.tableId,
            _fields: allTableFields,
            _rows: [],
            _totalCount: 0,
            _error: 'Failed to execute view',
          },
        };
      }

      // Filter fields to only those configured in the view
      const viewFields = filterFieldsToView(allTableFields, result.fields);

      return {
        props: {
          ...props,
          _viewName: view.name,
          _tableId: view.tableId,
          _fields: viewFields,
          _rows: result.rows,
          _totalCount: result.totalCount,
          _error: undefined,
        },
      };
    } catch (error) {
      console.error('[DataBlock.resolveData] Error:', error);
      return {
        props: {
          ...props,
          _error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  // Cast render to satisfy TypeScript - templateContent uses custom Data type
  // that Puck's type inference doesn't understand
  render: DataBlock as ComponentConfig<DataBlockProps>['render'],
};

export default DataBlockConfig;
