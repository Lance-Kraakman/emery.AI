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
 * Dashboard Metric Widget
 * Individual metric with position and size in dashboard grid
 */
export interface DashboardMetricWidget {
  aggregation: AggregationConfigProps;
  position: { row: number; col: number };  // Grid position
  size: { rows: number; cols: number };    // Grid span
  title?: string;                          // Override aggregation label
}

/**
 * Dashboard View Configuration
 * Multiple metrics arranged in a grid layout
 */
export interface DashboardViewConfig {
  type: 'dashboard';
  metrics: DashboardMetricWidget[];
  layout: 'grid' | 'flex';           // Layout mode
  columns?: number;                   // Grid columns (default 12)
  gap?: 'small' | 'medium' | 'large'; // Spacing between widgets
}

/**
 * Recent Entries View Configuration
 * Show most recently added/updated entries with optional summary aggregations
 */
export interface RecentEntriesViewConfig {
  type: 'recent-entries';
  maxEntries?: number;                      // Limit on entries to show
  groupBy?: number;                          // Field ID to group by
  showSummary?: boolean;                     // Show summary aggregations
  summaryAggregations?: AggregationConfigProps[];
  dateField?: number;                        // Field ID for sorting by date
}

/**
 * Union of all view configuration types
 */
export type ViewConfigData =
  | GridViewConfig
  | MetricViewConfig
  | DashboardViewConfig
  | RecentEntriesViewConfig;

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

  static createDashboard(config: Omit<DashboardViewConfig, 'type'>): ViewConfig {
    return new ViewConfig({
      type: 'dashboard',
      ...config,
      metrics: config.metrics || [],
      layout: config.layout ?? 'grid',
      columns: config.columns ?? 12,
      gap: config.gap ?? 'medium',
    });
  }

  static createRecentEntries(config?: Omit<RecentEntriesViewConfig, 'type'>): ViewConfig {
    return new ViewConfig({
      type: 'recent-entries',
      maxEntries: config?.maxEntries ?? 10,
      showSummary: config?.showSummary ?? false,
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
      case 'dashboard':
        this.validateDashboardConfig(this._config);
        break;
      case 'recent-entries':
        this.validateRecentEntriesConfig(this._config);
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

  private validateDashboardConfig(config: DashboardViewConfig): void {
    if (!config.metrics || config.metrics.length === 0) {
      throw new Error("Dashboard view requires at least one metric");
    }

    // Validate all aggregations can be created
    for (const metric of config.metrics) {
      AggregationConfig.create(metric.aggregation);

      // Validate position and size
      if (metric.position.row < 0 || metric.position.col < 0) {
        throw new Error("Dashboard metric position must be non-negative");
      }
      if (metric.size.rows <= 0 || metric.size.cols <= 0) {
        throw new Error("Dashboard metric size must be positive");
      }
    }

    if (config.columns && config.columns <= 0) {
      throw new Error("Dashboard columns must be positive");
    }
  }

  private validateRecentEntriesConfig(config: RecentEntriesViewConfig): void {
    if (config.maxEntries !== undefined && config.maxEntries <= 0) {
      throw new Error("Recent entries maxEntries must be positive");
    }

    if (config.summaryAggregations) {
      // Validate all aggregations can be created
      for (const agg of config.summaryAggregations) {
        AggregationConfig.create(agg);
      }
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

  isDashboard(): this is { config: DashboardViewConfig } {
    return this._config.type === 'dashboard';
  }

  isRecentEntries(): this is { config: RecentEntriesViewConfig } {
    return this._config.type === 'recent-entries';
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

      case 'dashboard':
        return this._config.metrics.map(m =>
          AggregationConfig.create(m.aggregation)
        );

      case 'recent-entries':
        if (this._config.summaryAggregations) {
          return this._config.summaryAggregations.map(a =>
            AggregationConfig.create(a)
          );
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
   * Get dashboard config (type-safe accessor)
   */
  getDashboardConfig(): DashboardViewConfig | null {
    if (this.isDashboard()) {
      return this._config as DashboardViewConfig;
    }
    return null;
  }

  /**
   * Get recent entries config (type-safe accessor)
   */
  getRecentEntriesConfig(): RecentEntriesViewConfig | null {
    if (this.isRecentEntries()) {
      return this._config as RecentEntriesViewConfig;
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
