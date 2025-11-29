/**
 * DataBlock - Puck Component Configuration
 *
 * Unified data block that replaces DataContextBlock and RepeatBlock.
 * Supports two modes:
 * - single: Single record context (detail pages)
 * - list: Repeating items with layout options (list/grid)
 *
 * Flow:
 * 1. User selects a view and mode in Puck editor
 * 2. resolveData fetches data and field metadata
 * 3. DataBlock provides DataLayoutContext (fields) + RowDataContext (data) to children
 * 4. Child field blocks use useDataLayoutContext for field selection
 * 5. Child field blocks use useRowData for data access
 */

import type { ComponentConfig } from "@measured/puck";
import DataBlock, { type DataBlockProps } from "./DataBlock";
import { executeView, getView } from "@/app/actions/views";
import { getFields } from "@/app/actions/fields";
import { isPuckResolveContext, getContextValue } from "../../types/puck-context";
import { createViewManagementField } from "../../custom-fields";

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

    // Single mode: Row Selection Mode
    rowSelectionMode: {
      type: "radio",
      label: "Row Selection",
      options: [
        { label: "From Query Parameter", value: "param" },
        { label: "Static Row ID", value: "static" },
      ],
    },

    // Single mode: Query Parameter Name
    rowParam: {
      type: "text",
      label: "Query Parameter Name",
    },

    // Single mode: Static Row ID
    rowId: {
      type: "number",
      label: "Row ID",
    },

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
    rowSelectionMode: "param",
    rowParam: "id",
    layout: "vertical",
    columns: 2,
    gap: 16,
    itemsPerPage: 10,
    paginationStyle: "none",
    showCarouselArrows: false,
  },

  /**
   * Conditional field visibility based on mode
   */
  resolveFields: (data, { fields }) => {
    const mode = data.props.mode;
    const rowSelectionMode = data.props.rowSelectionMode;
    const layout = data.props.layout;

    // Base fields always shown
    const baseFields = {
      mode: fields.mode,
      viewId: fields.viewId,
    };

    if (mode === 'single') {
      // Single mode fields
      return {
        ...baseFields,
        rowSelectionMode: fields.rowSelectionMode,
        ...(rowSelectionMode === 'param' && { rowParam: fields.rowParam }),
        ...(rowSelectionMode === 'static' && { rowId: fields.rowId }),
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
      const fields = await getFields(view.tableId);

      // Execute view to get rows with server-side pagination for list mode
      const pageSize = props.mode === 'list' ? (props.itemsPerPage || 10) : undefined;
      const result = await executeView(
        props.viewId,
        metadata,
        pageSize ? { pageSize, offset: 0 } : undefined
      );
      if (!result) {
        console.error('[DataBlock.resolveData] Failed to execute view');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _tableId: view.tableId,
            _fields: fields,
            _rows: [],
            _resolvedRow: undefined,
            _totalCount: 0,
            _error: 'Failed to execute view',
          },
        };
      }

      // ============================================
      // SINGLE MODE: Find specific row
      // ============================================
      if (props.mode === 'single') {
        let targetRowId: number | undefined;

        if (props.rowSelectionMode === 'param') {
          // Get row ID from query param
          if (!isPuckResolveContext(metadata)) {
            return {
              props: {
                ...props,
                _viewName: view.name,
                _tableId: view.tableId,
                _fields: fields,
                _resolvedRow: undefined,
                _error: undefined,
              },
            };
          }

          const paramValue = getContextValue(metadata, props.rowParam || 'id');
          if (paramValue) {
            targetRowId = Number(paramValue);
          } else {
            return {
              props: {
                ...props,
                _viewName: view.name,
                _tableId: view.tableId,
                _fields: fields,
                _resolvedRow: undefined,
                _error: undefined,
              },
            };
          }
        } else if (props.rowSelectionMode === 'static') {
          targetRowId = props.rowId;
        }

        if (!targetRowId) {
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: fields,
              _resolvedRow: undefined,
              _error: undefined,
            },
          };
        }

        // Find the specific row
        const targetRow = result.rows.find(row => row.id === targetRowId);

        if (!targetRow) {
          return {
            props: {
              ...props,
              _viewName: view.name,
              _tableId: view.tableId,
              _fields: fields,
              _resolvedRow: undefined,
              _error: `Row ${targetRowId} not found`,
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

      // LIST MODE: Return rows (server already paginated)
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
