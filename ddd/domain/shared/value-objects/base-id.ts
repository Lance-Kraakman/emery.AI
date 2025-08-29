// AIDEV-NOTE: Generic base class for ID value objects
// Eliminates duplication between AgentId, OrganizationId, TeamId, etc.

export abstract class BaseId<T extends string = string> {
  protected readonly _value: number;
  protected readonly _type: T;

  constructor(value: number, type: T) {
    if (!Number.isInteger(value)) {
      throw new Error(`${type} must be an integer`);
    }
    
    if (value <= 0 && value !== -1) {
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

  /**
   * Create an ID for a new entity (allows 0 as placeholder before persistence)
   * @param type - The ID type for error messages
   * @returns BaseId with value 0
   */
  protected static createNew<T extends string>(type: T, value: number = 0): BaseId<T> {
    // Allow 0 for new entities, but still validate it's an integer
    if (!Number.isInteger(value)) {
      throw new Error(`${type} must be an integer`);
    }
    
    // Create instance without calling constructor to bypass positive integer check
    const instance = Object.create(BaseId.prototype);
    instance._value = value;
    instance._type = type;
    return instance;
  }
}