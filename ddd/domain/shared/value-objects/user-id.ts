// AIDEV-NOTE: Value object for user identity
// Provides type safety and domain validation for user IDs
// Note: Uses UUID string format as per schema

export class UserId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('UserId must be a non-empty string');
    }
    
    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('UserId must be a valid UUID format');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static fromString(value: string): UserId {
    return new UserId(value);
  }

  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }
}