/**
 * AggregationConfig Value Object
 *
 * Represents a single aggregation operation to be performed on a field.
 * Used by metric and dashboard views to compute summary statistics.
 *
 * AIDEV-NOTE: Aggregations are computed by the Python gRPC backend via
 * the extended QueryRows RPC. This Value Object stores the configuration
 * and provides serialization to protobuf format.
 */

export type AggregationType =
  | 'sum'            // Sum all values
  | 'avg'            // Average (mean) of values
  | 'count'          // Count of non-null values
  | 'min'            // Minimum value
  | 'max'            // Maximum value
  | 'count_distinct' // Count of unique values
  | 'count_empty'    // Count of null/empty values
  | 'count_not_empty'; // Count of non-null/non-empty values

export type FormatType = 'number' | 'currency' | 'percentage' | 'duration';

export interface AggregationConfigProps {
  fieldId: number;
  aggregationType: AggregationType;
  label?: string;        // Custom label for display (e.g., "Total Sales")
  formatType?: FormatType; // How to format the result
  decimals?: number;     // Number of decimal places (default: 2)
}

/**
 * Protobuf representation for gRPC serialization
 * TODO-AGGREGATIONS-FILTERING: Used when protobuf definition is extended
 */
export interface AggregationProtobuf {
  field_id: string;      // e.g., "field_5"
  type: string;          // Mapped aggregation type
  alias: string;         // Display name
  format_type: string;   // Formatting hint
}

export class AggregationConfig {
  private constructor(
    private readonly _fieldId: number,
    private readonly _aggregationType: AggregationType,
    private readonly _label?: string,
    private readonly _formatType?: FormatType,
    private readonly _decimals?: number
  ) {
    this.validate();
  }

  /**
   * Create AggregationConfig from properties
   */
  static create(props: AggregationConfigProps): AggregationConfig {
    return new AggregationConfig(
      props.fieldId,
      props.aggregationType,
      props.label,
      props.formatType,
      props.decimals
    );
  }

  /**
   * Validate aggregation configuration
   */
  private validate(): void {
    // Validate field ID
    if (!Number.isInteger(this._fieldId) || this._fieldId <= 0) {
      throw new Error("AggregationConfig fieldId must be a positive integer");
    }

    // Validate aggregation type
    const validTypes: AggregationType[] = [
      'sum', 'avg', 'count', 'min', 'max',
      'count_distinct', 'count_empty', 'count_not_empty'
    ];
    if (!validTypes.includes(this._aggregationType)) {
      throw new Error(
        `Invalid aggregation type: ${this._aggregationType}. Must be one of: ${validTypes.join(', ')}`
      );
    }

    // Validate decimals if provided
    if (this._decimals !== undefined) {
      if (!Number.isInteger(this._decimals) || this._decimals < 0 || this._decimals > 10) {
        throw new Error("AggregationConfig decimals must be an integer between 0 and 10");
      }
    }

    // Validate format type if provided
    if (this._formatType !== undefined) {
      const validFormats: FormatType[] = ['number', 'currency', 'percentage', 'duration'];
      if (!validFormats.includes(this._formatType)) {
        throw new Error(
          `Invalid format type: ${this._formatType}. Must be one of: ${validFormats.join(', ')}`
        );
      }
    }
  }

  /**
   * Getters for properties
   */
  get fieldId(): number {
    return this._fieldId;
  }

  get aggregationType(): AggregationType {
    return this._aggregationType;
  }

  get label(): string | undefined {
    return this._label;
  }

  get formatType(): FormatType | undefined {
    return this._formatType;
  }

  get decimals(): number {
    return this._decimals ?? 2; // Default to 2 decimal places
  }

  /**
   * Get default label if none provided
   */
  getDisplayLabel(): string {
    if (this._label) {
      return this._label;
    }

    // Generate label from aggregation type
    const typeLabels: Record<AggregationType, string> = {
      'sum': 'Sum',
      'avg': 'Average',
      'count': 'Count',
      'min': 'Minimum',
      'max': 'Maximum',
      'count_distinct': 'Unique Count',
      'count_empty': 'Empty Count',
      'count_not_empty': 'Non-Empty Count',
    };

    return `${typeLabels[this._aggregationType]} of Field ${this._fieldId}`;
  }

  /**
   * Serialize to protobuf format for gRPC
   *
   * TODO-AGGREGATIONS-FILTERING: This will be used when protobuf is extended
   * in Phase 4. The Python gRPC service will receive this format.
   */
  toProtobuf(): AggregationProtobuf {
    return {
      field_id: `field_${this._fieldId}`,
      type: this.mapAggregationTypeToProtobuf(this._aggregationType),
      alias: this._label || `agg_${this._fieldId}`,
      format_type: this._formatType || 'number',
    };
  }

  /**
   * Map TypeScript aggregation type to protobuf enum value
   *
   * TODO-AGGREGATIONS-FILTERING: Update when protobuf enum is defined
   */
  private mapAggregationTypeToProtobuf(type: AggregationType): string {
    const mapping: Record<AggregationType, string> = {
      'sum': 'AGG_TYPE_SUM',
      'avg': 'AGG_TYPE_AVG',
      'count': 'AGG_TYPE_COUNT',
      'min': 'AGG_TYPE_MIN',
      'max': 'AGG_TYPE_MAX',
      'count_distinct': 'AGG_TYPE_COUNT_DISTINCT',
      'count_empty': 'AGG_TYPE_COUNT_EMPTY',
      'count_not_empty': 'AGG_TYPE_COUNT_NOT_EMPTY',
    };
    return mapping[type];
  }

  /**
   * Equality comparison
   */
  equals(other: AggregationConfig): boolean {
    return (
      this._fieldId === other._fieldId &&
      this._aggregationType === other._aggregationType &&
      this._label === other._label &&
      this._formatType === other._formatType &&
      this._decimals === other._decimals
    );
  }

  /**
   * Serialize to JSON for database storage
   */
  toJSON(): AggregationConfigProps {
    return {
      fieldId: this._fieldId,
      aggregationType: this._aggregationType,
      label: this._label,
      formatType: this._formatType,
      decimals: this._decimals,
    };
  }

  /**
   * Create immutable copy with updated label
   */
  withLabel(label: string): AggregationConfig {
    return new AggregationConfig(
      this._fieldId,
      this._aggregationType,
      label,
      this._formatType,
      this._decimals
    );
  }

  /**
   * Create immutable copy with updated format type
   */
  withFormatType(formatType: FormatType): AggregationConfig {
    return new AggregationConfig(
      this._fieldId,
      this._aggregationType,
      this._label,
      formatType,
      this._decimals
    );
  }

  /**
   * Create immutable copy with updated decimals
   */
  withDecimals(decimals: number): AggregationConfig {
    return new AggregationConfig(
      this._fieldId,
      this._aggregationType,
      this._label,
      this._formatType,
      decimals
    );
  }
}
