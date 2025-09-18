// AIDEV-NOTE: InvitationToken Value Object - encapsulates invitation token logic
// Handles secure token generation, validation, and expiration management

import { randomBytes } from 'crypto';

export class InvitationToken {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Invitation token cannot be empty');
    }
    
    if (!this.isValid(value)) {
      throw new Error('Invalid invitation token format');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  private isValid(token: string): boolean {
    // Token format: 32 hex characters (128-bit entropy)
    const tokenRegex = /^[a-f0-9]{32}$/;
    return tokenRegex.test(token);
  }

  static fromString(value: string): InvitationToken {
    return new InvitationToken(value);
  }

  static generate(): InvitationToken {
    const randomHex = randomBytes(16).toString('hex'); // 32 hex characters
    return new InvitationToken(randomHex);
  }

  static isValidFormat(value: string): boolean {
    try {
      new InvitationToken(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get masked version for logging/display (shows only first and last 4 characters)
   */
  getMasked(): string {
    if (this._value.length < 8) {
      return '***'; // Fallback for invalid tokens
    }
    const first = this._value.substring(0, 4);
    const last = this._value.substring(this._value.length - 4);
    return `${first}...${last}`;
  }

  /**
   * Check if token has expired based on expiration date
   */
  static isExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Generate expiration date (default 7 days from now)
   */
  static generateExpirationDate(daysFromNow: number = 7): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + daysFromNow);
    return expiration;
  }

  equals(other: InvitationToken): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Compare with string value (for token validation)
   */
  matches(value: string): boolean {
    return this._value === value;
  }
}