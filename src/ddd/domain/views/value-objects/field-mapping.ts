/**
 * FieldMapping Value Object
 *
 * AIDEV-NOTE: Represents column visibility, order, and display name configuration in a view.
 * Follows Baserow's pattern where views store their own field display settings.
 *
 * Business Rules:
 * - sourceFieldId must be a positive integer (references field in table)
 * - displayName cannot be empty
 * - order must be non-negative
 * - visible determines if column is shown
 */

export interface FieldMappingProps {
  sourceFieldId: number;
  displayName: string;
  visible: boolean;
  order: number;
}

export class FieldMapping {
  private readonly _sourceFieldId: number;
  private readonly _displayName: string;
  private readonly _visible: boolean;
  private readonly _order: number;

  private constructor(props: FieldMappingProps) {
    this._sourceFieldId = props.sourceFieldId;
    this._displayName = props.displayName;
    this._visible = props.visible;
    this._order = props.order;

    this.validate();
  }

  static create(props: FieldMappingProps): FieldMapping {
    return new FieldMapping(props);
  }

  private validate(): void {
    if (this._sourceFieldId <= 0) {
      throw new Error("Field mapping sourceFieldId must be a positive integer");
    }

    if (!this._displayName || this._displayName.trim().length === 0) {
      throw new Error("Field mapping displayName cannot be empty");
    }

    if (this._order < 0) {
      throw new Error("Field mapping order cannot be negative");
    }
  }

  // Getters
  get sourceFieldId(): number {
    return this._sourceFieldId;
  }

  get displayName(): string {
    return this._displayName;
  }

  get visible(): boolean {
    return this._visible;
  }

  get order(): number {
    return this._order;
  }

  /**
   * Create a new FieldMapping with updated display name
   */
  withDisplayName(displayName: string): FieldMapping {
    return FieldMapping.create({
      sourceFieldId: this._sourceFieldId,
      displayName,
      visible: this._visible,
      order: this._order,
    });
  }

  /**
   * Create a new FieldMapping with updated visibility
   */
  withVisibility(visible: boolean): FieldMapping {
    return FieldMapping.create({
      sourceFieldId: this._sourceFieldId,
      displayName: this._displayName,
      visible,
      order: this._order,
    });
  }

  /**
   * Create a new FieldMapping with updated order
   */
  withOrder(order: number): FieldMapping {
    return FieldMapping.create({
      sourceFieldId: this._sourceFieldId,
      displayName: this._displayName,
      visible: this._visible,
      order,
    });
  }

  /**
   * Convert to JSON for serialization
   */
  toJSON(): {
    sourceFieldId: number;
    displayName: string;
    visible: boolean;
    order: number;
  } {
    return {
      sourceFieldId: this._sourceFieldId,
      displayName: this._displayName,
      visible: this._visible,
      order: this._order,
    };
  }

  /**
   * Equality comparison
   */
  equals(other: FieldMapping): boolean {
    return (
      this._sourceFieldId === other._sourceFieldId &&
      this._displayName === other._displayName &&
      this._visible === other._visible &&
      this._order === other._order
    );
  }
}
