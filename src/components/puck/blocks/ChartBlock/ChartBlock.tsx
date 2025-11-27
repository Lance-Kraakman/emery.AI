/**
 * ChartBlock - Client Component
 *
 * AIDEV-NOTE: This component renders chart visualizations using Recharts.
 * Data is resolved server-side via executeChartView and passed as props.
 * Supports both raw mode (plot table rows) and aggregated mode (GROUP BY).
 */

'use client';

import React from "react";
import {
  BarChart,
  LineChart,
  PieChart,
  AreaChart,
  ScatterChart,
  Bar,
  Line,
  Pie,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * Chart data values can be strings, numbers, booleans, or null
 * (representing database column values)
 */
type ChartDataValue = string | number | boolean | null | undefined;

export interface ChartBlockProps {
  // Configuration props (set in Puck editor)
  viewId?: number;
  width?: string;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;

  // Resolved data (injected by resolveData hook)
  _viewName?: string;
  _dataPoints?: Array<{
    x: ChartDataValue;
    y: ChartDataValue;
    [key: string]: ChartDataValue;
  }>;
  _xAxisLabel?: string;
  _yAxisLabels?: string[];
  _chartType?: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  _dataMode?: 'raw' | 'aggregated';
}

// Recharts color palette
const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7c7c',
  '#8dd1e1',
  '#d084d8',
  '#a4de6c',
];

/**
 * ChartBlock Component
 *
 * Renders chart visualizations using Recharts library.
 * Chart data is pre-fetched server-side.
 */
export default function ChartBlock(props: ChartBlockProps) {
  const {
    viewId,
    width = '100%',
    height = 400,
    showLegend = true,
    showGrid = true,
    _viewName,
    _dataPoints,
    _xAxisLabel,
    _yAxisLabels,
    _chartType = 'bar',
    _dataMode = 'raw',
  } = props;

  console.log('[ChartBlock render] Rendering with props:', {
    hasView: !!viewId,
    viewId,
    viewName: _viewName,
    dataPointCount: _dataPoints?.length,
    chartType: _chartType,
    dataMode: _dataMode,
    xAxisLabel: _xAxisLabel,
    yAxisLabels: _yAxisLabels,
  });

  // Debug: Log first few data points
  if (_dataPoints && _dataPoints.length > 0) {
    console.log('[ChartBlock render] Sample data points:', _dataPoints.slice(0, 3));
  }

  // If no view selected, show placeholder
  if (!viewId) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        border: '2px dashed #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Select a chart view to display
        </p>
      </div>
    );
  }

  // If view selected but no data, show empty state
  if (!_dataPoints || _dataPoints.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        backgroundColor: '#fafafa',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <p style={{ color: '#666', fontSize: '16px' }}>
          No data available
          {_viewName && ` from ${_viewName}`}
        </p>
      </div>
    );
  }

  // Render the appropriate chart type
  const renderChart = () => {
    const commonProps = {
      data: _dataPoints,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    switch (_chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="x" label={{ value: _xAxisLabel, position: 'insideBottom', offset: -10 }} />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            {_yAxisLabels && _yAxisLabels.map((label, index) => (
              <Bar
                key={label}
                dataKey={label}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="x" label={{ value: _xAxisLabel, position: 'insideBottom', offset: -10 }} />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            {_yAxisLabels && _yAxisLabels.map((label, index) => (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey="x" label={{ value: _xAxisLabel, position: 'insideBottom', offset: -10 }} />
            <YAxis />
            <Tooltip />
            {showLegend && <Legend />}
            {_yAxisLabels && _yAxisLabels.map((label, index) => (
              <Area
                key={label}
                type="monotone"
                dataKey={label}
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        // For pie charts, use the first y-axis label
        const dataKey = _yAxisLabels && _yAxisLabels.length > 0 ? _yAxisLabels[0] : 'y';
        return (
          <PieChart>
            <Pie
              data={_dataPoints}
              dataKey={dataKey}
              nameKey="x"
              cx="50%"
              cy="50%"
              outerRadius={120}
              label
            >
              {_dataPoints.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            {showLegend && <Legend />}
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis
              type="number"
              dataKey="x"
              name={_xAxisLabel || 'x'}
              label={{ value: _xAxisLabel, position: 'insideBottom', offset: -10 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={_yAxisLabels?.[0] || 'y'}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            {showLegend && <Legend />}
            {_yAxisLabels && _yAxisLabels.map((label, index) => (
              <Scatter
                key={label}
                name={label}
                data={_dataPoints.map(p => ({
                  x: Number(p.x) || 0,
                  y: Number(p[label]) || 0
                }))}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </ScatterChart>
        );

      default:
        return <div>Unsupported chart type: {_chartType}</div>;
    }
  };

  return (
    <div style={{ width, padding: '20px' }}>
      {_viewName && (
        <h3 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 600 }}>
          {_viewName}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
        {_dataMode === 'aggregated' && <span>Aggregated data</span>}
        {_dataMode === 'raw' && <span>{_dataPoints.length} data points</span>}
      </div>
    </div>
  );
}
