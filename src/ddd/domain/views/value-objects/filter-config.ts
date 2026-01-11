/**
 * FilterConfig Value Object
 *
 * AIDEV-NOTE: Represents a single filter condition for data source queries.
 * Supports common operators for different field types.
 * Immutable - use factory methods to create instances.
 */

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "is_empty"
  | "is_not_empty"
  | "is_true"
  | "is_false"
  | "in"
  | "not_in";

export interface FilterConfigProps {
  fieldId: number;
  operator: FilterOperator;
  value?: string | number | boolean | null | Array<string | number | null>;
}

export class FilterConfig {
  private constructor(
    private readonly _fieldId: number,
    private readonly _operator: FilterOperator,
    private readonly _value?: string | number | boolean | null | Array<string | number | null>
  ) {
    this.validate();
  }

  static create(props: FilterConfigProps): FilterConfig {
    return new FilterConfig(props.fieldId, props.operator, props.value);
  }

  private validate(): void {
    if (this._fieldId <= 0 || !Number.isInteger(this._fieldId)) {
      throw new Error("FilterConfig fieldId must be a positive integer");
    }

    // Operators that don't require a value
    const noValueOperators: FilterOperator[] = [
      "is_empty",
      "is_not_empty",
      "is_true",
      "is_false",
    ];

    if (!noValueOperators.includes(this._operator) && this._value === undefined) {
      throw new Error(`FilterConfig operator "${this._operator}" requires a value`);
    }

    if (noValueOperators.includes(this._operator) && this._value !== undefined) {
      throw new Error(`FilterConfig operator "${this._operator}" should not have a value`);
    }
  }

  get fieldId(): number {
    return this._fieldId;
  }

  get operator(): FilterOperator {
    return this._operator;
  }

  get value(): string | number | boolean | null | Array<string | number | null> | undefined {
    return this._value;
  }

  /**
   * Converts filter to SQL WHERE clause fragment
   * AIDEV-NOTE: This is a basic implementation. In production, use parameterized queries.
   */
  toSQLCondition(columnName: string): string {
    switch (this._operator) {
      case "equals":
        return `${columnName} = ${this.formatValue()}`;
      case "not_equals":
        return `${columnName} != ${this.formatValue()}`;
      case "contains":
        return `${columnName} LIKE '%${this._value}%'`;
      case "not_contains":
        return `${columnName} NOT LIKE '%${this._value}%'`;
      case "starts_with":
        return `${columnName} LIKE '${this._value}%'`;
      case "ends_with":
        return `${columnName} LIKE '%${this._value}'`;
      case "greater_than":
        return `${columnName} > ${this.formatValue()}`;
      case "greater_than_or_equal":
        return `${columnName} >= ${this.formatValue()}`;
      case "less_than":
        return `${columnName} < ${this.formatValue()}`;
      case "less_than_or_equal":
        return `${columnName} <= ${this.formatValue()}`;
      case "is_empty":
        return `${columnName} IS NULL OR ${columnName} = ''`;
      case "is_not_empty":
        return `${columnName} IS NOT NULL AND ${columnName} != ''`;
      case "is_true":
        return `${columnName} = TRUE`;
      case "is_false":
        return `${columnName} = FALSE`;
      case "in":
        return `${columnName} IN (${this.formatArrayValue()})`;
      case "not_in":
        return `${columnName} NOT IN (${this.formatArrayValue()})`;
      default:
        throw new Error(`Unsupported filter operator: ${this._operator}`);
    }
  }

  private formatValue(): string {
    if (typeof this._value === "string") {
      return `'${this._value.replace(/'/g, "''")}'`; // Escape single quotes
    }
    if (typeof this._value === "boolean") {
      return this._value ? "TRUE" : "FALSE";
    }
    if (this._value === null) {
      return "NULL";
    }
    return String(this._value);
  }

  private formatArrayValue(): string {
    // Handle array values for IN/NOT IN operators
    const arr = Array.isArray(this._value) ? this._value : [this._value];
    return arr.map(v => {
      if (typeof v === "string") {
        return `'${v.replace(/'/g, "''")}'`;
      }
      if (v === null) {
        return "NULL";
      }
      return String(v);
    }).join(", ");
  }

  toJSON(): FilterConfigProps {
    return {
      fieldId: this._fieldId,
      operator: this._operator,
      value: this._value,
    };
  }

  equals(other: FilterConfig): boolean {
    return (
      this._fieldId === other._fieldId &&
      this._operator === other._operator &&
      this._value === other._value
    );
  }
}
