// AIDEV-NOTE: Base class for string-based ID value objects (like UUIDs)
// For entities that use string identities instead of numbers

export abstract class BaseStringId<T extends string = string> {
  protected readonly _value: string;
  protected readonly _type: T;

  constructor(value: string, type: T) {
    if (!value || value.trim().length === 0) {
      throw new Error(`${type} cannot be empty`);
    }
    
    this._value = value.trim();
    this._type = type;
  }

  get value(): string {
    return this._value;
  }

  equals(other: BaseStringId<T>): boolean {
    return this._value === other._value && this._type === other._type;
  }

  toString(): string {
    return this._value;
  }
}