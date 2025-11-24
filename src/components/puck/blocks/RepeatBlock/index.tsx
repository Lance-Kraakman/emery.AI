/**
 * RepeatBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: Iterates over view data and renders a custom layout for each row.
 * Uses Puck zones to allow users to design the item template.
 *
 * Flow:
 * 1. User selects a view in Puck editor
 * 2. User designs the layout in itemTemplate zone (drag blocks)
 * 3. resolveData fetches rows from view
 * 4. RepeatBlock renders itemTemplate for each row with RowDataContext
 */

import type { ComponentConfig } from "@measured/puck";
import RepeatBlock, { type RepeatBlockProps } from "./RepeatBlock";
import { executeView } from "@/app/actions/views";
import { createViewManagementField } from "../../custom-fields";

export const RepeatBlockConfig: ComponentConfig<RepeatBlockProps> = {
  label: "Repeat",

  fields: {
    // View Selection
    viewId: createViewManagementField({
      supportedViewTypes: ['grid'], // Repeat uses grid views for row data
      label: 'Data Source (Grid View)',
    }),

    // Pagination
    itemsPerPage: {
      label: "Items Per Page",
      type: "number",
      min: 1,
      max: 100,
    },

    showMoreButton: {
      label: "Show 'Load More' Button",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    // Layout
    orientation: {
      label: "Layout Orientation",
      type: "radio",
      options: [
        { label: "Vertical (Stack)", value: "vertical" },
        { label: "Horizontal (Grid)", value: "horizontal" },
      ],
    },

    // Grid configuration (for horizontal layout)
    columns: {
      label: "Columns (Horizontal Mode)",
      type: "number",
      min: 1,
      max: 6,
    },

    gap: {
      label: "Gap Between Items",
      type: "select",
      options: [
        { label: "None", value: "0" },
        { label: "Small", value: "2" },
        { label: "Medium", value: "4" },
        { label: "Large", value: "6" },
        { label: "XL", value: "8" },
      ],
    },

    // Hidden fields populated by resolveData
    _viewName: {
      label: "View Name",
      type: "text",
      visible: false,
    },
    _tableId: {
      label: "Table ID",
      type: "number",
      visible: false,
    },
  },

  defaultProps: {
    viewId: 0,
    itemsPerPage: 10,
    showMoreButton: true,
    orientation: "vertical",
    columns: 2,
    gap: "4",
  },

  /**
   * Server-side data resolution
   * Fetches rows from the selected view
   */
  resolveData: async ({ props }) => {
    console.log('[RepeatBlock.resolveData] Starting resolution for view:', props.viewId);

    if (!props.viewId) {
      console.log('[RepeatBlock.resolveData] No viewId provided');
      return {
        props: {
          ...props,
          _viewName: undefined,
          _tableId: undefined,
          _rows: [],
          _totalCount: 0,
        },
      };
    }

    try {
      // Execute view to get rows
      const result = await executeView(props.viewId);

      if (!result) {
        console.error('[RepeatBlock.resolveData] Failed to execute view');
        return {
          props: {
            ...props,
            _viewName: 'Error loading data',
            _tableId: undefined,
            _rows: [],
            _totalCount: 0,
          },
        };
      }

      console.log('[RepeatBlock.resolveData] Data fetched successfully');
      console.log('[RepeatBlock.resolveData] Rows:', result.rows.length);

      // TODO: Get view name and table ID from view metadata
      // For now, use placeholder
      return {
        props: {
          ...props,
          _viewName: `View ${props.viewId}`,
          _tableId: undefined,
          _rows: result.rows,
          _totalCount: result.totalCount,
        },
      };
    } catch (error) {
      console.error('[RepeatBlock.resolveData] Error:', error);
      return {
        props: {
          ...props,
          _viewName: 'Error loading data',
          _tableId: undefined,
          _rows: [],
          _totalCount: 0,
        },
      };
    }
  },

  render: RepeatBlock,
};

export default RepeatBlockConfig;
