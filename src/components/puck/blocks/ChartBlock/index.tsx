/**
 * ChartBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for ChartBlock.
 * Chart views store chart configuration (type, dataMode, axes, aggregations) in the database.
 * Chart data is computed at the backend (Python/Polars via gRPC for aggregations, or direct table queries for raw mode).
 *
 * Flow:
 * 1. User selects a chart view in Puck editor (view must have viewType='chart')
 * 2. resolveData executes on server, calls executeChartView server action
 * 3. Backend computes/fetches chart data (aggregated or raw mode)
 * 4. ChartBlock component receives pre-computed data points as props
 * 5. Recharts renders the visualization
 */

import type { ComponentConfig } from "@measured/puck";
import ChartBlock, { type ChartBlockProps } from "./ChartBlock";
import { getView, executeChartView } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";
import { createViewManagementField } from "../../custom-fields";

export const ChartBlockConfig: ComponentConfig<ChartBlockProps> = {
  label: "Chart",

  fields: {
    // View Selection - Inline creation and editing support
    // AIDEV-NOTE: Using custom view management field for inline chart view creation.
    // Users can create/edit chart views directly from the Puck sidebar.
    viewId: createViewManagementField({
      supportedViewTypes: ['chart'],
      label: 'Chart View',
    }),

    // Hidden fields populated by resolveData
    _viewName: {
      label: "View Name",
      type: "text",
      visible: false,
    },
    _chartType: {
      label: "Chart Type",
      type: "text",
      visible: false,
    },
    _dataMode: {
      label: "Data Mode",
      type: "text",
      visible: false,
    },

    // Display Options
    width: {
      label: "Width",
      type: "text",
    },
    height: {
      label: "Height (px)",
      type: "number",
    },
    showLegend: {
      label: "Show Legend",
      type: "radio",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    showGrid: {
      label: "Show Grid",
      type: "radio",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
  },

  defaultProps: {
    width: '100%',
    height: 400,
    showLegend: true,
    showGrid: true,
  },

  /**
   * Server-side data resolution
   *
   * AIDEV-NOTE: Executes chart view at backend.
   * - Raw mode: Fetches table rows directly and maps to chart data points
   * - Aggregated mode: Computes GROUP BY aggregations via gRPC
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      console.log('[ChartBlock resolveData] Starting with props:', {
        viewId: props.viewId
      });

      // If no view selected, return props as-is
      if (!props.viewId || isNaN(props.viewId)) {
        console.log('[ChartBlock resolveData] No valid viewId provided');
        return { props };
      }

      const viewId = props.viewId;

      // Get view details to verify it's a chart view
      const view = await getView(viewId);
      if (!view) {
        console.error('[ChartBlock resolveData] Failed to get view details for viewId:', viewId);
        return {
          props: {
            ...props,
            _dataPoints: [],
          } as any,
        };
      }

      // Verify view type is 'chart'
      if (view.viewType !== 'chart') {
        console.error('[ChartBlock resolveData] View is not a chart view:', view.viewType);
        return {
          props: {
            ...props,
            _viewName: view.name,
            _dataPoints: [],
          } as any,
        };
      }

      // Execute chart view via server action
      console.log('[ChartBlock resolveData] Executing chart view for view:', viewId);
      const result = await executeChartView(viewId);

      if (!result || !result.dataPoints) {
        console.error('[ChartBlock resolveData] executeChartView returned no data');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _dataPoints: [],
          } as any,
        };
      }

      console.log('[ChartBlock resolveData] Got chart data:', {
        viewId,
        viewName: view.name,
        dataPointCount: result.dataPoints.length,
        chartType: result.chartType,
        dataMode: result.dataMode,
        xAxisLabel: result.xAxisLabel,
        yAxisLabels: result.yAxisLabels,
      });

      // Return props with resolved chart data
      return {
        props: {
          ...props,
          _viewName: view.name,
          _dataPoints: result.dataPoints,
          _xAxisLabel: result.xAxisLabel,
          _yAxisLabels: result.yAxisLabels,
          _chartType: result.chartType,
          _dataMode: result.dataMode,
        } as any,
      };
    } catch (error) {
      console.error("[ChartBlock resolveData] Fatal error:", error);
      console.error("[ChartBlock resolveData] Error stack:", error instanceof Error ? error.stack : 'No stack');

      // Return safe fallback on error
      return {
        props: {
          ...props,
          _dataPoints: [],
        } as any,
      };
    }
  },

  render: (props) => {
    return <ChartBlock {...(props as any)} />;
  },
};

export default ChartBlockConfig;
