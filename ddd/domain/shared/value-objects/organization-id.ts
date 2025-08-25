// AIDEV-NOTE: Value object for organization identity
// Provides type safety and domain validation for organization IDs

export class OrganizationId {
  private readonly _value: number;

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('OrganizationId must be a positive integer');
    }
    
    this._value = value;
  }

  get value(): number {
    return this._value;
  }

  equals(other: OrganizationId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }

  static fromNumber(value: number): OrganizationId {
    return new OrganizationId(value);
  }
}