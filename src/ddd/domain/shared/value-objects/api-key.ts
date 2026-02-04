// AIDEV-NOTE: ApiKey Value Object - encapsulates API key validation, generation, and hashing
// After Phase 6 hashing: _value stores the SHA-256 hash (loaded from DB), NOT the plaintext.
// Plaintext is only available at generation time via generateWithHash() / generateUserKeyWithHash().

import { createHash, randomBytes } from 'crypto';

export interface ApiKeyGenerated {
  plaintext: string;
  hash: string;
  prefix: string;
}

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

  /** Returns the stored value (hash when loaded from DB, or raw value) */
  get value(): string {
    return this._value;
  }

  private isValid(key: string): boolean {
    // Accept any non-empty string as valid API key
    // Supports hashes (64-char hex), internal format (key_xxx), user format (user_xxx)
    return key.length > 0;
  }

  static fromString(value: string): ApiKey {
    return new ApiKey(value);
  }

  /** Compute SHA-256 hash of a plaintext key */
  static hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }

  /** Get display prefix (first 12 chars) of a plaintext key */
  static prefix(plaintext: string): string {
    return plaintext.substring(0, 12);
  }

  /**
   * Generate agent API key with hash (256-bit entropy, key_ prefix)
   * Returns plaintext (show once), hash (store), and prefix (display)
   */
  static generateWithHash(): ApiKeyGenerated {
    const randomHex = randomBytes(32).toString('hex'); // 64 hex chars, 256-bit
    const plaintext = `key_${randomHex}`;
    return {
      plaintext,
      hash: ApiKey.hash(plaintext),
      prefix: ApiKey.prefix(plaintext),
    };
  }

  /**
   * Generate user API key with hash (192-bit entropy, user_ prefix)
   * Returns plaintext (show once), hash (store), and prefix (display)
   */
  static generateUserKeyWithHash(): ApiKeyGenerated {
    const randomHex = randomBytes(24).toString('hex'); // 48 hex chars, 192-bit
    const plaintext = `user_${randomHex}`;
    return {
      plaintext,
      hash: ApiKey.hash(plaintext),
      prefix: ApiKey.prefix(plaintext),
    };
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
   * Get masked version for display.
   * When _value is a hash (64 hex chars), shows first 8 + last 4.
   * For prefixes, shows the prefix directly.
   */
  getMasked(): string {
    if (this._value.length < 12) {
      return '***';
    }
    const first = this._value.substring(0, 8);
    const last = this._value.substring(this._value.length - 4);
    return `${first}...${last}`;
  }

  /**
   * Check if a plaintext key matches this stored hash.
   * Hashes the plaintext and compares with the stored value.
   */
  matchesPlaintext(plaintext: string): boolean {
    return ApiKey.hash(plaintext) === this._value;
  }

  equals(other: ApiKey): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
