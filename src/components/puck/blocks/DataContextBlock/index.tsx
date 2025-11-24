/**
 * DataContextBlock - Puck Component Configuration
 *
 * Provides single-record context to child blocks.
 * Like RepeatBlock but for ONE specific record.
 *
 * Flow:
 * 1. User selects a view and row selection mode
 * 2. resolveData fetches the specific row
 * 3. DataContextBlock provides row context to children
 * 4. Children blocks access data via useRowData()
 */

import type { ComponentConfig } from "@measured/puck";
import DataContextBlock, { type DataContextBlockProps } from "./DataContextBlock";
import { executeView } from "@/app/actions/views";
import { isPuckResolveContext, getContextValue } from "../../types/puck-context";

export const DataContextBlockConfig: ComponentConfig<DataContextBlockProps> = {
  label: "Data Context",

  fields: {
    // View Selection
    viewId: {
      type: "number",
      label: "Data Source (View ID)",
      // TODO: Replace with view selector dropdown
    },

    // Row Selection Mode
    mode: {
      type: "radio",
      label: "Row Selection",
      options: [
        { label: "From Query Parameter", value: "param" },
        { label: "Static Row ID", value: "static" },
      ],
    },

    // Query Parameter Name (for mode=param)
    rowParam: {
      type: "text",
      label: "Query Parameter Name",
      // TODO: Use resolveFields to show/hide based on mode
    },

    // Static Row ID (for mode=static)
    rowId: {
      type: "number",
      label: "Row ID",
      // TODO: Use resolveFields to show/hide based on mode
    },

    // Hidden fields populated by resolveData
    _viewName: {
      type: "text",
      label: "View Name",
      visible: false,
    },
    _error: {
      type: "text",
      label: "Error",
      visible: false,
    },
  },

  defaultProps: {
    viewId: 0,
    mode: "param",
    rowParam: "id",
  },

  /**
   * Server-side data resolution
   * Fetches the specific row from the view
   *
   * Note: The second parameter contains { metadata }, where metadata is our context/query params
   */
  resolveData: async ({ props }, { metadata }) => {
    console.log('[DataContextBlock.resolveData] Starting resolution');
    console.log('[DataContextBlock.resolveData] Props:', props);
    console.log('[DataContextBlock.resolveData] Metadata (context):', metadata);

    if (!props.viewId) {
      console.log('[DataContextBlock.resolveData] No viewId provided');
      return {
        props: {
          ...props,
          _viewName: undefined,
          _resolvedRow: undefined,
          _error: undefined,
        },
      };
    }

    try {
      // Determine row ID based on mode
      let targetRowId: number | undefined;

      if (props.mode === 'param') {
        // Get row ID from query param
        if (!isPuckResolveContext(metadata)) {
          console.warn('[DataContextBlock.resolveData] Invalid metadata/context shape');
          return {
            props: {
              ...props,
              _viewName: `View ${props.viewId}`,
              _resolvedRow: undefined,
              _error: 'No query parameters available',
            },
          };
        }

        const paramValue = getContextValue(metadata, props.rowParam || 'id');
        if (paramValue) {
          targetRowId = Number(paramValue);
          console.log(`[DataContextBlock.resolveData] Row ID from param "${props.rowParam}":`, targetRowId);
        } else {
          console.log(`[DataContextBlock.resolveData] Query param "${props.rowParam}" not found in metadata`);
          return {
            props: {
              ...props,
              _viewName: `View ${props.viewId}`,
              _resolvedRow: undefined,
              _error: undefined,
            },
          };
        }
      } else if (props.mode === 'static') {
        // Use static row ID
        targetRowId = props.rowId;
        console.log('[DataContextBlock.resolveData] Using static row ID:', targetRowId);
      }

      if (!targetRowId) {
        console.log('[DataContextBlock.resolveData] No row ID determined');
        return {
          props: {
            ...props,
            _viewName: `View ${props.viewId}`,
            _resolvedRow: undefined,
            _error: undefined,
          },
        };
      }

      // Execute view to get rows (pass metadata as context for future filtering)
      const result = await executeView(props.viewId, metadata);

      if (!result) {
        console.error('[DataContextBlock.resolveData] Failed to execute view');
        return {
          props: {
            ...props,
            _viewName: 'Error loading data',
            _resolvedRow: undefined,
            _error: 'Failed to execute view',
          },
        };
      }

      console.log('[DataContextBlock.resolveData] View executed successfully');
      console.log('[DataContextBlock.resolveData] Total rows:', result.rows.length);

      // Find the specific row by ID
      const targetRow = result.rows.find(row => row.id === targetRowId);

      if (!targetRow) {
        console.log('[DataContextBlock.resolveData] Row not found:', targetRowId);
        return {
          props: {
            ...props,
            _viewName: `View ${props.viewId}`,
            _resolvedRow: undefined,
            _error: `Row ${targetRowId} not found`,
          },
        };
      }

      console.log('[DataContextBlock.resolveData] Row found:', targetRow);

      return {
        props: {
          ...props,
          _viewName: `View ${props.viewId}`,
          _resolvedRow: targetRow,
          _error: undefined,
        },
      };
    } catch (error) {
      console.error('[DataContextBlock.resolveData] Error:', error);
      return {
        props: {
          ...props,
          _viewName: 'Error loading data',
          _resolvedRow: undefined,
          _error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  render: DataContextBlock,
};

export default DataContextBlockConfig;
