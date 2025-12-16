/**
 * MetricBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: This is the Puck config for MetricBlock.
 * Metric views store aggregation configuration (field, type, format) in the database.
 * The aggregation is computed at the backend (Python/Polars via gRPC), never in Node.js/browser.
 *
 * Flow:
 * 1. User selects a metric view in Puck editor (view must have viewType='metric')
 * 2. resolveData executes on server, calls executeViewAggregations server action
 * 3. Backend computes aggregation via gRPC (filters applied first, then aggregation)
 * 4. MetricBlock component receives pre-computed value as props
 *
 * TODO-CACHING: Add caching layer for aggregation results with configurable TTL.
 * Cache should be invalidated on data changes or manual refresh.
 */

import type { ComponentConfig } from "@measured/puck";
import MetricBlock, { type MetricBlockProps } from "./MetricBlock";
import { getView, executeViewAggregations } from "@/app/actions/views";
import { getTables } from "@/app/actions/tables";
import { typographySizeField, backgroundColorField, textColorField, fontFamilyField, fontWeightField, borderRadiusField, borderWidthField, paddingField } from "../../fields/standard-fields";
import { createViewManagementField } from "../../custom-fields";

export const MetricBlockConfig: ComponentConfig<MetricBlockProps> = {
  label: "Metric",

  fields: {
    // View Selection - Inline creation and editing support
    // AIDEV-NOTE: Using custom view management field for inline metric view creation.
    // Users can create/edit metric views directly from the Puck sidebar.
    viewId: createViewManagementField({
      supportedViewTypes: ['metric'],
      label: 'Metric View',
    }),

    // Hidden fields populated by resolveData
    _viewName: {
      label: "View Name",
      type: "text",
      visible: false,
    },
    _metricLabel: {
      label: "Metric Label",
      type: "text",
      visible: false,
    },
    _metricType: {
      label: "Metric Type",
      type: "text",
      visible: false,
    },

    // Display Options
    showLabel: {
      label: "Show Label",
      type: "radio",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    showChange: {
      label: "Show Change Indicator",
      type: "radio",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    size: typographySizeField,
    labelColor: {
      ...textColorField,
      label: "Label Color (Optional)",
    },
    valueColor: {
      ...textColorField,
      label: "Value Color (Optional)",
    },
    backgroundColor: backgroundColorField,
    labelFontFamily: {
      ...fontFamilyField,
      label: "Label Font Family (Optional)",
    },
    labelFontWeight: {
      ...fontWeightField,
      label: "Label Font Weight (Optional)",
    },
    valueFontFamily: {
      ...fontFamilyField,
      label: "Value Font Family (Optional)",
    },
    valueFontWeight: {
      ...fontWeightField,
      label: "Value Font Weight (Optional)",
    },
    radius: borderRadiusField,
    borderWidth: borderWidthField,
    padding: paddingField,
  },

  defaultProps: {
    showLabel: true,
    showChange: false,
    size: '2xl',
    labelColor: undefined,
    valueColor: undefined,
    backgroundColor: undefined,
    labelFontFamily: undefined,
    labelFontWeight: undefined,
    valueFontFamily: undefined,
    valueFontWeight: undefined,
    radius: undefined,
    borderWidth: undefined,
    padding: undefined,
  },

  /**
   * Server-side data resolution
   *
   * AIDEV-NOTE: Executes view aggregation at backend via gRPC.
   * The aggregation is computed in Python using Polars, following Baserow's architecture.
   * Filters from the view are applied before aggregation (WHERE before GROUP BY).
   */
  resolveData: async ({ props }, { metadata }) => {
    try {
      console.log('[MetricBlock resolveData] Starting with props:', {
        viewId: props.viewId
      });

      // If no view selected, return props as-is
      if (!props.viewId || isNaN(props.viewId)) {
        console.log('[MetricBlock resolveData] No valid viewId provided');
        return { props };
      }

      const viewId = props.viewId;

      // Get view details to verify it's a metric view
      const view = await getView(viewId);
      if (!view) {
        console.error('[MetricBlock resolveData] Failed to get view details for viewId:', viewId);
        return {
          props: {
            ...props,
            _metricValue: null,
          } as any,
        };
      }

      // Verify view type is 'metric'
      if (view.viewType !== 'metric') {
        console.error('[MetricBlock resolveData] View is not a metric view:', view.viewType);
        return {
          props: {
            ...props,
            _viewName: view.name,
            _metricValue: null,
          } as any,
        };
      }

      // Execute aggregation via server action
      console.log('[MetricBlock resolveData] Executing aggregations for view:', viewId);
      const result = await executeViewAggregations(viewId);

      if (!result || !result.results || result.results.length === 0) {
        console.error('[MetricBlock resolveData] executeViewAggregations returned no results');
        return {
          props: {
            ...props,
            _viewName: view.name,
            _metricValue: null,
          } as any,
        };
      }

      // Metric views should have exactly one aggregation result
      const metricResult = result.results[0];

      console.log('[MetricBlock resolveData] Aggregation result:', JSON.stringify(metricResult));

      console.log('[MetricBlock resolveData] Got aggregation result:', {
        viewId,
        viewName: view.name,
        fieldId: metricResult.fieldId,
        aggregationType: metricResult.aggregationType,
        value: metricResult.value,
        label: metricResult.label,
        formatType: metricResult.formatType,
      });

      // Return props with resolved aggregation data
      return {
        props: {
          ...props,
          _viewName: view.name,
          _metricValue: metricResult.value,
          _metricLabel: metricResult.label,
          _metricType: metricResult.aggregationType,
          _formatType: metricResult.formatType || 'number',
          _decimals: 0, // TODO: Add decimals to AggregationConfig
        } as any,
      };
    } catch (error) {
      console.error("[MetricBlock resolveData] Fatal error:", error);
      console.error("[MetricBlock resolveData] Error stack:", error instanceof Error ? error.stack : 'No stack');

      // Return safe fallback on error
      return {
        props: {
          ...props,
          _metricValue: null,
        } as any,
      };
    }
  },

  render: (props) => {
    return <MetricBlock {...(props as any)} />;
  },
};

export default MetricBlockConfig;
