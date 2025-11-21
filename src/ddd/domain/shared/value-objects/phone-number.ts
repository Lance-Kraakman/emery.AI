// AIDEV-NOTE: PhoneNumber Value Object - encapsulates phone number validation logic
// Eliminates primitive obsession and centralizes phone number business rules
// Supports E.164 international format: +[country code][number] (max 15 digits)

export class PhoneNumber {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Phone number cannot be empty');
    }

    const normalized = this.normalize(value);
    if (!this.isValid(normalized)) {
      throw new Error('Invalid phone number format - must be in E.164 format (+[country code][number], max 15 digits)');
    }

    this._value = normalized;
  }

  get value(): string {
    return this._value;
  }

  /**
   * Normalize phone number by removing spaces, dashes, parentheses
   */
  private normalize(phone: string): string {
    return phone.trim().replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Validate E.164 format: +[country code][number] (max 15 digits)
   */
  private isValid(phone: string): boolean {
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  static fromString(value: string): PhoneNumber {
    return new PhoneNumber(value);
  }

  static isValidPhone(value: string): boolean {
    try {
      new PhoneNumber(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract country code from E.164 format
   * Returns null if no + prefix or can't determine country code
   */
  getCountryCode(): string | null {
    if (!this._value.startsWith('+')) {
      return null;
    }

    // Most country codes are 1-3 digits
    // E.g., +1 (USA), +44 (UK), +886 (Taiwan)
    const matches = this._value.match(/^\+(\d{1,3})/);
    return matches ? matches[1] : null;
  }

  /**
   * Get national number (without country code)
   */
  getNationalNumber(): string {
    const countryCode = this.getCountryCode();
    if (countryCode) {
      return this._value.slice(countryCode.length + 1); // +1 for the '+' sign
    }
    return this._value;
  }

  /**
   * Format phone number for display
   * @param style - 'international' (+1 555-123-4567), 'national' (555-123-4567), 'e164' (+15551234567)
   */
  format(style: 'international' | 'national' | 'e164' = 'international'): string {
    if (style === 'e164') {
      return this._value.startsWith('+') ? this._value : `+${this._value}`;
    }

    const countryCode = this.getCountryCode();
    const nationalNumber = this.getNationalNumber();

    if (style === 'national') {
      return this.formatNationalNumber(nationalNumber);
    }

    // International format
    if (countryCode) {
      return `+${countryCode} ${this.formatNationalNumber(nationalNumber)}`;
    }

    return this.formatNationalNumber(this._value);
  }

  /**
   * Simple national number formatting (can be enhanced per country)
   */
  private formatNationalNumber(number: string): string {
    // Basic formatting for 10-digit numbers (e.g., US)
    if (number.length === 10) {
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`;
    }

    // For other lengths, just return as-is
    return number;
  }

  equals(other: PhoneNumber): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
