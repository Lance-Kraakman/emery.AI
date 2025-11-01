/**
 * ViewType Value Object
 *
 * Represents the type of view, determining how data is displayed and whether
 * aggregations are computed. Follows Baserow's multi-view-type architecture.
 *
 * AIDEV-NOTE: View types determine data transformation behavior:
 * - grid: Raw table rows (existing behavior)
 * - metric: Single aggregated value
 * - dashboard: Multiple aggregated metrics
 * - recent-entries: Sorted by recency, optional summary aggregations
 */

export type ViewTypeValue =
  | 'grid'            // Standard table view with rows/columns
  | 'metric'          // Single metric display (e.g., "Total Sales: $150,000")
  | 'dashboard'       // Multiple metrics in grid layout
  | 'recent-entries'; // Recently added/updated entries

export class ViewType {
  private constructor(private readonly _value: ViewTypeValue) {}

  /**
   * Create ViewType from string value
   * Validates that value is a supported view type
   */
  static create(value: ViewTypeValue): ViewType {
    const validTypes: ViewTypeValue[] = ['grid', 'metric', 'dashboard', 'recent-entries'];

    if (!validTypes.includes(value)) {
      throw new Error(
        `Invalid view type: ${value}. Must be one of: ${validTypes.join(', ')}`
      );
    }

    return new ViewType(value);
  }

  /**
   * Factory methods for common view types
   */
  static grid(): ViewType {
    return new ViewType('grid');
  }

  static metric(): ViewType {
    return new ViewType('metric');
  }

  static dashboard(): ViewType {
    return new ViewType('dashboard');
  }

  static recentEntries(): ViewType {
    return new ViewType('recent-entries');
  }

  /**
   * Get the raw string value
   */
  get value(): ViewTypeValue {
    return this._value;
  }

  /**
   * Type guard methods
   */
  isGrid(): boolean {
    return this._value === 'grid';
  }

  isMetric(): boolean {
    return this._value === 'metric';
  }

  isDashboard(): boolean {
    return this._value === 'dashboard';
  }

  isRecentEntries(): boolean {
    return this._value === 'recent-entries';
  }

  /**
   * Check if this view type requires aggregation computation
   *
   * AIDEV-NOTE: Metric and dashboard views need aggregations computed
   * via the backend QueryRows RPC with aggregation config.
   */
  requiresAggregation(): boolean {
    return this._value === 'metric' || this._value === 'dashboard';
  }

  /**
   * Check if this view type displays raw table rows
   */
  displaysRows(): boolean {
    return this._value === 'grid' || this._value === 'recent-entries';
  }

  /**
   * Equality comparison
   */
  equals(other: ViewType): boolean {
    return this._value === other._value;
  }

  /**
   * Serialize to string for database storage
   */
  toString(): string {
    return this._value;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): ViewTypeValue {
    return this._value;
  }
}
