/**
 * SortConfig Value Object
 *
 * AIDEV-NOTE: Represents sorting configuration for data source queries.
 * Supports multiple sort rules with priority ordering.
 * Immutable value object.
 */

export type SortDirection = "asc" | "desc";

export interface SortConfigProps {
  fieldId: number;
  direction: SortDirection;
  priority?: number; // Lower number = higher priority (0 is highest)
}

export class SortConfig {
  private constructor(
    private readonly _fieldId: number,
    private readonly _direction: SortDirection,
    private readonly _priority: number = 0
  ) {
    this.validate();
  }

  static create(props: SortConfigProps): SortConfig {
    return new SortConfig(props.fieldId, props.direction, props.priority);
  }

  private validate(): void {
    if (this._fieldId <= 0 || !Number.isInteger(this._fieldId)) {
      throw new Error("SortConfig fieldId must be a positive integer");
    }

    if (this._direction !== "asc" && this._direction !== "desc") {
      throw new Error("SortConfig direction must be 'asc' or 'desc'");
    }

    if (this._priority < 0 || !Number.isInteger(this._priority)) {
      throw new Error("SortConfig priority must be a non-negative integer");
    }
  }

  get fieldId(): number {
    return this._fieldId;
  }

  get direction(): SortDirection {
    return this._direction;
  }

  get priority(): number {
    return this._priority;
  }

  /**
   * Converts sort config to SQL ORDER BY clause fragment
   */
  toSQLFragment(columnName: string): string {
    return `${columnName} ${this._direction.toUpperCase()}`;
  }

  toJSON(): SortConfigProps {
    return {
      fieldId: this._fieldId,
      direction: this._direction,
      priority: this._priority,
    };
  }

  equals(other: SortConfig): boolean {
    return (
      this._fieldId === other._fieldId &&
      this._direction === other._direction &&
      this._priority === other._priority
    );
  }

  /**
   * Compares sort configs by priority for ordering
   */
  comparePriority(other: SortConfig): number {
    return this._priority - other._priority;
  }
}
