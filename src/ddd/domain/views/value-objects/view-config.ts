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
 * Union of all view configuration types
 */
export type ViewConfigData =
  | GridViewConfig
  | MetricViewConfig;

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
