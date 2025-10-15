// AIDEV-NOTE: Value object for RAG document identity
// Provides type safety and domain validation for document IDs

import crypto from 'crypto';

export class DocumentId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('DocumentId cannot be empty');
    }
    
    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('DocumentId must be a valid UUID');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: DocumentId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(): DocumentId {
    // Generate new UUID
    const uuid = crypto.randomUUID();
    return new DocumentId(uuid);
  }

  static fromString(value: string): DocumentId {
    return new DocumentId(value);
  }
}