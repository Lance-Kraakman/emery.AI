/**
 * ViewConfig Value Object
 *
 * Type-specific configuration for different view types, stored as JSONB in database.
 * Provides type-safe access to view-specific settings and aggregation configurations.
 *
 * AIDEV-NOTE: This wraps the JSONB view_config column with typed structures.
 * Each view type has its own configuration schema validated at runtime.
 */

import { AggregationConfig, type AggregationConfigProps } from './aggregation-config';

/**
 * Grid View Configuration
 * Standard table display with customizable row height and header behavior
 */
export interface GridViewConfig {
  type: 'grid';
  showRowNumbers?: boolean;
  stickyHeader?: boolean;
  rowHeight?: 'compact' | 'comfortable' | 'spacious';
  defaultPageSize?: number;
}

/**
 * Metric View Configuration
 * Single aggregated value display (e.g., "Total Sales: $150,000")
 */
export interface MetricViewConfig {
  type: 'metric';
  aggregation: AggregationConfigProps;
  showTrend?: boolean;              // Show trend line/sparkline
  trendPeriod?: 'day' | 'week' | 'month';
  compareToAverage?: boolean;       // Show comparison to average
}

/**
 * Chart View Configuration
 * Recharts-based data visualization with raw or aggregated data
 */
export interface ChartViewConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  dataMode: 'raw' | 'aggregated';

  // Raw mode: plot row data directly
  xAxisFieldId?: number;        // Field for X axis
  yAxisFieldIds?: number[];     // Field(s) for Y axis - multiple series support

  // Aggregated mode: GROUP BY + aggregations
  groupByFieldId?: number;      // GROUP BY this field (becomes X axis)
  aggregations?: AggregationConfigProps[];  // Multiple Y series via aggregations

  // Optional: chart data limits
  maxDataPoints?: number;       // Limit number of data points
  sortBy?: 'x' | 'y';          // Sort data by X or Y axis
  sortDirection?: 'asc' | 'desc';
}

/**
 * Union of all view configuration types
 */
export type ViewConfigData =
  | GridViewConfig
  | MetricViewConfig
  | ChartViewConfig;

export class ViewConfig {
  private constructor(private readonly _config: ViewConfigData) {
    this.validate();
  }

  /**
   * Factory methods for creating view configs
   */
  static createGrid(config?: Omit<GridViewConfig, 'type'>): ViewConfig {
    return new ViewConfig({
      type: 'grid',
      showRowNumbers: config?.showRowNumbers ?? false,
      stickyHeader: config?.stickyHeader ?? true,
      rowHeight: config?.rowHeight ?? 'comfortable',
      defaultPageSize: config?.defaultPageSize ?? 50,
    });
  }

  static createMetric(config: Omit<MetricViewConfig, 'type'>): ViewConfig {
    return new ViewConfig({
      type: 'metric',
      ...config,
    });
  }

  static createChart(config: Omit<ChartViewConfig, 'type'>): ViewConfig {
    return new ViewConfig({
      type: 'chart',
      ...config,
    });
  }

  /**
   * Create from JSON (database deserialization)
   */
  static fromJSON(data: ViewConfigData): ViewConfig {
    return new ViewConfig(data);
  }

  /**
   * Validate configuration based on type
   */
  private validate(): void {
    if (!this._config || !this._config.type) {
      throw new Error("ViewConfig must have a type");
    }

    switch (this._config.type) {
      case 'metric':
        this.validateMetricConfig(this._config);
        break;
      case 'chart':
        this.validateChartConfig(this._config);
        break;
      case 'grid':
        // Grid config has no required fields
        break;
      default:
        throw new Error(`Unknown view config type: ${(this._config as any).type}`);
    }
  }

  private validateMetricConfig(config: MetricViewConfig): void {
    if (!config.aggregation) {
      throw new Error("Metric view requires aggregation configuration");
    }

    // Validate aggregation can be created
    AggregationConfig.create(config.aggregation);
  }

  private validateChartConfig(config: ChartViewConfig): void {
    // Validate chart type
    const validChartTypes = ['bar', 'line', 'pie', 'area', 'scatter'];
    if (!validChartTypes.includes(config.chartType)) {
      throw new Error(`Invalid chart type: ${config.chartType}`);
    }

    // Validate data mode
    if (config.dataMode !== 'raw' && config.dataMode !== 'aggregated') {
      throw new Error(`Invalid chart data mode: ${config.dataMode}`);
    }

    // Validate based on data mode
    if (config.dataMode === 'raw') {
      if (!config.xAxisFieldId) {
        throw new Error('Chart view in raw mode requires xAxisFieldId');
      }
      if (!config.yAxisFieldIds || config.yAxisFieldIds.length === 0) {
        throw new Error('Chart view in raw mode requires at least one yAxisFieldId');
      }
    } else if (config.dataMode === 'aggregated') {
      if (!config.groupByFieldId) {
        throw new Error('Chart view in aggregated mode requires groupByFieldId');
      }
      if (!config.aggregations || config.aggregations.length === 0) {
        throw new Error('Chart view in aggregated mode requires at least one aggregation');
      }
      // Validate each aggregation can be created
      config.aggregations.forEach(agg => AggregationConfig.create(agg));
    }
  }

  /**
   * Get the view type
   */
  get type(): ViewConfigData['type'] {
    return this._config.type;
  }

  /**
   * Get the raw config data
   */
  get config(): ViewConfigData {
    return this._config;
  }

  /**
   * Type guards
   */
  isGrid(): this is { config: GridViewConfig } {
    return this._config.type === 'grid';
  }

  isMetric(): this is { config: MetricViewConfig } {
    return this._config.type === 'metric';
  }

  isChart(): this is { config: ChartViewConfig } {
    return this._config.type === 'chart';
  }

  /**
   * Extract all aggregations from this view config
   *
   * AIDEV-NOTE: This is used by ViewApplicationService.executeAggregations()
   * to get all aggregations that need to be computed via gRPC.
   */
  getAggregations(): AggregationConfig[] {
    switch (this._config.type) {
      case 'metric':
        return [AggregationConfig.create(this._config.aggregation)];

      case 'chart':
        if (this._config.dataMode === 'aggregated' && this._config.aggregations) {
          return this._config.aggregations.map(a => AggregationConfig.create(a));
        }
        return [];

      case 'grid':
        return [];

      default:
        return [];
    }
  }

  /**
   * Get metric config (type-safe accessor)
   */
  getMetricConfig(): MetricViewConfig | null {
    if (this.isMetric()) {
      return this._config as MetricViewConfig;
    }
    return null;
  }

  /**
   * Get grid config (type-safe accessor)
   */
  getGridConfig(): GridViewConfig | null {
    if (this.isGrid()) {
      return this._config as GridViewConfig;
    }
    return null;
  }

  /**
   * Get chart config (type-safe accessor)
   */
  getChartConfig(): ChartViewConfig | null {
    if (this.isChart()) {
      return this._config as ChartViewConfig;
    }
    return null;
  }

  /**
   * Serialize to JSON for database storage
   */
  toJSON(): ViewConfigData {
    return this._config;
  }

  /**
   * Equality comparison
   */
  equals(other: ViewConfig): boolean {
    return JSON.stringify(this._config) === JSON.stringify(other._config);
  }
}
