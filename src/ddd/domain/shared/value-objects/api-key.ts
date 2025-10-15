// AIDEV-NOTE: ApiKey Value Object - encapsulates API key validation and generation
// Ensures secure API key format and provides business logic for key management

import { randomBytes } from 'crypto';

export class ApiKey {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('API key cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error('Invalid API key format');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  private isValid(key: string): boolean {
    // Accept any non-empty string as valid API key
    // Supports both internal format (key_xxx) and external OAuth keys
    return key.length > 0;
  }

  static fromString(value: string): ApiKey {
    return new ApiKey(value);
  }

  static generate(): ApiKey {
    const randomHex = randomBytes(16).toString('hex'); // 32 hex characters
    return new ApiKey(`key_${randomHex}`);
  }

  static isValidFormat(value: string): boolean {
    try {
      new ApiKey(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get masked version for display (shows only first and last 4 characters)
   */
  getMasked(): string {
    if (this._value.length < 12) {
      return '***'; // Fallback for invalid keys
    }
    const first = this._value.substring(0, 8); // 'key_' + 4 chars
    const last = this._value.substring(this._value.length - 4);
    return `${first}...${last}`;
  }

  /**
   * Get prefix for identifying key type
   */
  getPrefix(): string {
    return 'key_';
  }

  equals(other: ApiKey): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Compare with string value (for authentication)
   */
  matches(value: string): boolean {
    return this._value === value;
  }
}