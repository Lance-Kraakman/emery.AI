/**
 * ViewType Value Object
 *
 * Represents the type of view, determining how data is displayed and whether
 * aggregations are computed.
 *
 * AIDEV-NOTE: View types determine data transformation behavior:
 * - grid: Raw table rows with filters/sorting
 * - metric: Single aggregated value (sum, avg, count, etc.)
 * - chart: Recharts visualization with raw or aggregated data
 * - form: Data entry form for creating new rows
 */

export type ViewTypeValue =
  | 'grid'            // Standard table view with rows/columns
  | 'metric'          // Single metric display (e.g., "Total Sales: $150,000")
  | 'chart'           // Chart visualization (bar, line, pie, area, scatter)
  | 'form';           // Form for data entry (create new rows)

export class ViewType {
  private constructor(private readonly _value: ViewTypeValue) {}

  /**
   * Create ViewType from string value
   * Validates that value is a supported view type
   */
  static create(value: ViewTypeValue): ViewType {
    const validTypes: ViewTypeValue[] = ['grid', 'metric', 'chart', 'form'];

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

  static chart(): ViewType {
    return new ViewType('chart');
  }

  static form(): ViewType {
    return new ViewType('form');
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

  isChart(): boolean {
    return this._value === 'chart';
  }

  isForm(): boolean {
    return this._value === 'form';
  }

  /**
   * Check if this view type requires aggregation computation
   *
   * AIDEV-NOTE: Metric views always need aggregations.
   * Chart views need aggregations ONLY when in aggregated mode (checked in ViewConfig).
   * Form views never need aggregations (they create rows, not display data).
   */
  requiresAggregation(): boolean {
    return this._value === 'metric' || this._value === 'chart';
  }

  /**
   * Check if this view type displays raw table rows
   *
   * AIDEV-NOTE: Grid views always display rows.
   * Chart views display rows ONLY when in raw mode (checked in ViewConfig).
   * Form views don't display rows (they create new rows via user input).
   */
  displaysRows(): boolean {
    return this._value === 'grid' || this._value === 'chart';
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
