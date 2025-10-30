/**
 * DataSourceId Value Object
 *
 * AIDEV-NOTE: Immutable identifier for data source entities.
 * Follows the same pattern as TableId, AgentId, etc.
 */

export class DataSourceId {
  private constructor(private readonly _value: number) {
    if (_value <= 0 || !Number.isInteger(_value)) {
      throw new Error("DataSourceId must be a positive integer");
    }
  }

  static fromNumber(value: number): DataSourceId {
    return new DataSourceId(value);
  }

  get value(): number {
    return this._value;
  }

  equals(other: DataSourceId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}
