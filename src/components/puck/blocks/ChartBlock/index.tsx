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
import { getView, executeChartView, getViewsForOrganization } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";

export const ChartBlockConfig: ComponentConfig<ChartBlockProps> = {
  label: "Chart",

  fields: {
    // View Selection - Filtered to only show chart-type views
    viewId: {
      label: "Chart View",
      type: "external",
      placeholder: "Select a chart view",
      showSearch: true,
      fetchList: async ({ query }: { query: string }) => {
        console.log('[ChartBlock viewId fetchList] Fetching chart views');

        // Get all views and filter to chart-type only
        const [views, tables] = await Promise.all([
          getViewsForOrganization(),
          getTables()
        ]);

        console.log('[ChartBlock viewId fetchList] Found views:', views.length, 'tables:', tables.length);

        // Filter to chart views only
        const chartViews = views.filter(v => v.viewType === 'chart');

        console.log('[ChartBlock viewId fetchList] Chart views:', chartViews.length);

        // Create a table lookup map
        const tableMap = new Map(tables.map(t => [t.id, t.name]));

        // Filter by query if provided
        const filteredViews = query
          ? chartViews.filter((v) =>
              v.name.toLowerCase().includes(query.toLowerCase()) ||
              tableMap.get(v.tableId)?.toLowerCase().includes(query.toLowerCase())
            )
          : chartViews;

        const result = filteredViews.map((v) => {
          // Extract chart info from viewConfig for better display
          const config = v.viewConfig as any;
          const chartType = config?.chartType || 'unknown';
          const dataMode = config?.dataMode || 'unknown';

          return {
            id: v.id,
            name: v.name,
            tableId: v.tableId,
            tableName: tableMap.get(v.tableId) || `Table ${v.tableId}`,
            title: `${v.name}`,
            description: `Table: ${tableMap.get(v.tableId) || v.tableId} | Type: ${chartType} | Mode: ${dataMode}`,
          };
        });

        console.log('[ChartBlock viewId fetchList] Returning options:', result.length);
        return result;
      },
      mapProp: (item: any) => item?.id || null,
      getItemSummary: (item: any, context: any) => {
        const viewId = typeof item === 'number' ? item : item?.id;
        const viewName = context?.props?._viewName;
        const chartType = context?.props?._chartType;

        if (viewName) {
          return chartType ? `${viewName} (${chartType})` : viewName;
        } else if (viewId) {
          return `Chart View ID: ${viewId}`;
        }
        return "No chart view selected";
      },
    } as any,

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
      if (!props.viewId) {
        console.log('[ChartBlock resolveData] No view selected, returning empty');
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
