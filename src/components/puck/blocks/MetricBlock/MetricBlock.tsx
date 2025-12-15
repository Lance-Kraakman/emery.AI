/**
 * MetricBlock - Server Component
 *
 * AIDEV-NOTE: This component displays a single aggregated metric value.
 * Data is computed at the backend (Python/Polars via gRPC) via executeViewAggregations.
 * Following Baserow's architecture pattern for metric views with backend aggregations.
 */

'use client';

import React from "react";
import styles from "./styles.module.css";
import type { TypographySize } from "../../utils/typography";
import type { FourSidedSpacing, FourCornerRadius } from "../../types/spacing-types";
import { useTheme } from "../../theme-context";
import { computeFourSidedCSS, computeFourCornerRadiusCSS } from "../../utils/spacing";

export interface MetricBlockProps {
  // Configuration props (set in Puck editor)
  viewId?: number;                  // Selected metric view ID
  showLabel?: boolean;              // Show metric label
  showChange?: boolean;             // Show change indicator (future)
  size?: TypographySize;            // Typography size (xs-5xl)
  labelColor?: string;              // Optional label color override
  valueColor?: string;              // Optional value color override
  backgroundColor?: string;         // Optional background color override
  labelFontFamily?: string;         // Optional label font family override
  labelFontWeight?: string;         // Optional label font weight override
  valueFontFamily?: string;         // Optional value font family override
  valueFontWeight?: string;         // Optional value font weight override
  radius?: FourCornerRadius;        // Optional border radius override
  borderWidth?: string;             // Optional border width override
  padding?: FourSidedSpacing;       // Optional padding

  // Resolved data (injected by resolveData hook)
  _viewName?: string;               // View name for display
  _metricValue?: any;               // Aggregated value
  _metricLabel?: string;            // Metric label
  _metricType?: string;             // Aggregation type (sum, avg, etc.)
  _formatType?: string;             // Format type (number, currency, percentage)
  _decimals?: number;               // Decimal places for formatting
}

/**
 * MetricBlock Component
 *
 * Renders a single metric value with optional label and formatting.
 * Value is pre-computed server-side via aggregation.
 */
export default function MetricBlock(props: MetricBlockProps) {
  const {
    viewId,
    showLabel = true,
    showChange = false,
    size = '2xl',
    labelColor,
    valueColor,
    backgroundColor,
    labelFontFamily,
    labelFontWeight,
    valueFontFamily,
    valueFontWeight,
    radius,
    borderWidth,
    padding,
    _viewName,
    _metricValue,
    _metricLabel,
    _metricType,
    _formatType = 'number',
    _decimals = 0,
  } = props;

  console.log('[MetricBlock render] Rendering with props:', {
    hasView: !!viewId,
    viewId,
    viewName: _viewName,
    metricValue: _metricValue,
    metricLabel: _metricLabel,
    metricType: _metricType,
    formatType: _formatType,
  });

  // If no view selected, show placeholder
  if (!viewId) {
    console.log('[MetricBlock render] No view selected, showing placeholder');
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>📊</div>
        <p className={styles.placeholderText}>
          Select a metric view to display
        </p>
      </div>
    );
  }

  // If view selected but no data, show empty state
  if (_metricValue === undefined || _metricValue === null) {
    console.log('[MetricBlock render] No metric value, showing empty state');
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📭</div>
        <p className={styles.emptyText}>
          No data available
          {_viewName && ` from ${_viewName}`}
        </p>
      </div>
    );
  }

  // Format the metric value based on formatType
  const formatValue = (value: any, formatType: string, decimals: number): string => {
    const numValue = typeof value === 'number' ? value : parseFloat(value);

    if (isNaN(numValue)) {
      return String(value);
    }

    switch (formatType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(numValue);

      case 'percentage':
        return new Intl.NumberFormat('en-US', {
          style: 'percent',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(numValue / 100); // Assuming value is already in percentage form

      case 'number':
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(numValue);
    }
  };

  const formattedValue = formatValue(_metricValue, _formatType, _decimals);
  const displayLabel = _metricLabel || _viewName || 'Metric';

  const theme = useTheme();
  const paddingStyles = padding ? computeFourSidedCSS(padding, theme, 'padding') : {};
  const radiusStyles = radius ? computeFourCornerRadiusCSS(radius, theme) : {};

  return (
    <div
      className={styles.metricBlock}
      data-size={size}
      style={{
        ...(backgroundColor && { backgroundColor }),
        ...radiusStyles,
        ...(borderWidth && { borderWidth }),
        ...paddingStyles,
      }}
    >
      {showLabel && (
        <div
          className={styles.label}
          data-size={size}
          style={{
            ...(labelColor && { color: labelColor }),
            ...(labelFontFamily && { fontFamily: labelFontFamily }),
            ...(labelFontWeight && { fontWeight: labelFontWeight }),
          }}
        >
          {displayLabel}
          {_metricType && (
            <span className={styles.metricType}>
              ({_metricType})
            </span>
          )}
        </div>
      )}

      <div
        className={styles.value}
        data-size={size}
        style={{
          ...(valueColor && { color: valueColor }),
          ...(valueFontFamily && { fontFamily: valueFontFamily }),
          ...(valueFontWeight && { fontWeight: valueFontWeight }),
        }}
      >
        {formattedValue}
      </div>

      {showChange && (
        <div className={styles.change}>
          {/* TODO-CACHING: Add trend/change calculation by comparing with cached historical value */}
          <span className={styles.changeText}>Change data not available</span>
        </div>
      )}
    </div>
  );
}
