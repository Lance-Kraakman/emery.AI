// AIDEV-NOTE: Value object for RAG index identity
// Provides type safety and domain validation for index IDs

export class RagIndexId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('RagIndexId cannot be empty');
    }
    
    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('RagIndexId must be a valid UUID');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: RagIndexId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(): RagIndexId {
    // Generate new UUID - will be implemented with crypto.randomUUID()
    const uuid = crypto.randomUUID();
    return new RagIndexId(uuid);
  }

  static fromString(value: string): RagIndexId {
    return new RagIndexId(value);
  }
}