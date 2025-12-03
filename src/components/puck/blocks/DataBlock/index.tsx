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
 */

import type { ComponentConfig } from "@measured/puck";
import DataBlock, { type DataBlockProps } from "./DataBlock";
import { executeView, getView } from "@/app/actions/views";
import { executePublicView } from "@/app/actions/public-pages";
import { getFields } from "@/app/actions/fields";
import { isPuckResolveContext } from "../../types/puck-context";
import { createViewManagementField } from "../../custom-fields";
import { SingleRowFilterField, type SingleRowFilterConfig } from "../../fields/SingleRowFilterField";

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

    // List mode: Gap (in pixels)
    gap: {
      type: "number",
      label: "Gap (px)",
      min: 0,
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

    // Slot for item template content
    children: {
      type: "slot",
    },

    // Hidden fields populated by resolveData
    _viewName: { type: "text", label: "View Name", visible: false },
    _tableId: { type: "number", label: "Table ID", visible: false },
    _error: { type: "text", label: "Error", visible: false },
  },

  defaultProps: {
    mode: "single",
    singleRowFilter: {
      field: "id",
      operator: "eq",
      valueType: "variable",
      value: "{params.id}",
    },
    layout: "vertical",
    columns: 2,
    gap: 16,
    itemsPerPage: 10,
    paginationStyle: "none",
    showCarouselArrows: false,
  },

  /**
   * Conditional field visibility based on mode
   * Also dynamically creates singleRowFilter field with viewId in closure
   */
  resolveFields: (data, { fields }) => {
    const mode = data.props.mode;
    const layout = data.props.layout;
    const viewId = data.props.viewId;

    // Base fields always shown
    const baseFields = {
      mode: fields.mode,
      viewId: fields.viewId,
    };

    if (mode === 'single') {
      // Single mode: dynamically create singleRowFilter with viewId in closure
      return {
        ...baseFields,
        singleRowFilter: {
          type: "custom" as const,
          label: "Row Filter",
          render: ({ value, onChange }: { value: SingleRowFilterConfig | undefined; onChange: (v: SingleRowFilterConfig) => void }) => (
            <SingleRowFilterField
              key={viewId}  // Force remount when viewId changes
              value={value}
              onChange={onChange}
              viewId={viewId}
            />
          ),
        },
        children: fields.children,
      };
    }

    // List mode fields
    return {
      ...baseFields,
      layout: fields.layout,
      ...(layout === 'grid' && { columns: fields.columns }),
      gap: fields.gap,
      itemsPerPage: fields.itemsPerPage,
      paginationStyle: fields.paginationStyle,
      maxHeight: fields.maxHeight,
      ...(layout === 'horizontal' && { showCarouselArrows: fields.showCarouselArrows }),
      children: fields.children,
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

      // Get fields for the table (for field selector)
      // Pass viewId so RLS can check public access via fields_public_via_view policy
      const fields = await getFields(view.tableId, { viaViewId: props.viewId });

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
      // SINGLE MODE: Filter-based row selection
      // ============================================
      if (props.mode === 'single') {
        const filter = props.singleRowFilter;

        // Validate filter configuration
        if (!filter?.field || !filter?.value) {
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: fields,
              _resolvedRow: undefined,
              _error: undefined, // No error, just not configured yet
            },
          };
        }

        // Build the filter for single row selection
        // Variables like {params.product_id} are substituted in executeView/executePublicView
        const singleRowFilter = [{
          field: filter.field,
          operator: filter.operator || 'eq',
          value: filter.value,
        }];

        // Execute view with filter - fetch only 1 row
        const result = await doExecuteView(
          { pageSize: 1, offset: 0 },
          singleRowFilter
        );

        if (!result) {
          console.error('[DataBlock.resolveData] Failed to execute view for single mode');
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: fields,
              _resolvedRow: undefined,
              _error: 'Failed to execute view',
            },
          };
        }

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
              _fields: fields,
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
            _fields: fields,
            _resolvedRow: targetRow,
            _error: undefined,
          },
        };
      }

      // ============================================
      // LIST MODE: Return paginated rows
      // ============================================
      const pageSize = props.itemsPerPage || 10;
      const result = await doExecuteView({ pageSize, offset: 0 });

      if (!result) {
        console.error('[DataBlock.resolveData] Failed to execute view for list mode');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _tableId: view.tableId,
            _fields: fields,
            _rows: [],
            _totalCount: 0,
            _error: 'Failed to execute view',
          },
        };
      }

      return {
        props: {
          ...props,
          _viewName: view.name,
          _tableId: view.tableId,
          _fields: fields,
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

  render: DataBlock,
};

export default DataBlockConfig;
