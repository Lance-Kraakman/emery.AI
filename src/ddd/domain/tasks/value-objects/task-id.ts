// AIDEV-NOTE: Value object for task identity
// Provides type safety and domain validation for task IDs
// Note: Uses UUID string format as per schema

import crypto from 'crypto';

export class TaskId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('TaskId must be a non-empty string');
    }
    
    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('TaskId must be a valid UUID format');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: TaskId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static fromString(value: string): TaskId {
    return new TaskId(value);
  }

  static generate(): TaskId {
    return new TaskId(crypto.randomUUID());
  }
}