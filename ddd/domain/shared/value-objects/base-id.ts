// AIDEV-NOTE: Generic base class for ID value objects
// Eliminates duplication between AgentId, OrganizationId, TeamId, etc.

export abstract class BaseId<T extends string = string> {
  protected readonly _value: number;
  protected readonly _type: T;

  constructor(value: number, type: T, allowZero = false) {
    if (!Number.isInteger(value)) {
      throw new Error(`${type} must be an integer`);
    }
    
    if (allowZero && value < 0) {
      throw new Error(`${type} must be a non-negative integer`);
    } else if (!allowZero && value <= 0) {
      throw new Error(`${type} must be a positive integer`);
    }
    
    this._value = value;
    this._type = type;
  }

  get value(): number {
    return this._value;
  }

  equals(other: BaseId<T>): boolean {
    return this._value === other._value && this._type === other._type;
  }

  toString(): string {
    return this._value.toString();
  }
}