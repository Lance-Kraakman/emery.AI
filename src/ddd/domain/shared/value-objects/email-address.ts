// AIDEV-NOTE: EmailAddress Value Object - encapsulates email validation logic
// Eliminates primitive obsession and centralizes email business rules

export class EmailAddress {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Email address cannot be empty');
    }
    
    const trimmedValue = value.trim().toLowerCase();
    if (!this.isValid(trimmedValue)) {
      throw new Error('Invalid email address format');
    }
    
    this._value = trimmedValue;
  }

  get value(): string {
    return this._value;
  }

  private isValid(email: string): boolean {
    // RFC 5322 compliant email validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
  }

  static fromString(value: string): EmailAddress {
    return new EmailAddress(value);
  }

  static isValidEmail(value: string): boolean {
    try {
      new EmailAddress(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get domain part of email address
   */
  getDomain(): string {
    return this._value.split('@')[1];
  }

  /**
   * Get local part of email address (before @)
   */
  getLocalPart(): string {
    return this._value.split('@')[0];
  }

  /**
   * Check if email is from a specific domain
   */
  isFromDomain(domain: string): boolean {
    return this.getDomain() === domain.toLowerCase();
  }

  equals(other: EmailAddress): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}