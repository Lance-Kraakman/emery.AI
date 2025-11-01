// AIDEV-NOTE: FieldName Value Object - encapsulates database field naming rules
// Ensures field names follow database constraints and naming conventions

export class FieldName {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Field name cannot be empty');
    }
    
    const trimmedValue = value.trim();
    if (!this.isValid(trimmedValue)) {
      throw new Error('Invalid field name: must be 1-64 characters, alphanumeric with underscores, cannot start with number');
    }
    
    this._value = trimmedValue;
  }

  get value(): string {
    return this._value;
  }

  private isValid(name: string): boolean {
    // Database field naming rules:
    // - 1-64 characters
    // - Only alphanumeric and underscores
    // - Cannot start with a number
    // - Case insensitive (normalized to lowercase)
    const fieldNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
    return fieldNameRegex.test(name) && name.length >= 1 && name.length <= 64;
  }

  static fromString(value: string): FieldName {
    return new FieldName(value);
  }

  static isValidFieldName(value: string): boolean {
    try {
      new FieldName(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get normalized version (lowercase with consistent underscores)
   */
  getNormalized(): string {
    return this._value.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Generate database column name (field_{id} format)
   * Baserow-compatible naming convention for dynamic columns
   *
   * @param fieldId - Numeric field ID
   * @returns Column name in field_{id} format
   */
  static getDatabaseColumnName(fieldId: number): string {
    return `field_${fieldId}`;
  }

  /**
   * Check if this is a reserved field name
   */
  isReserved(): boolean {
    const reservedNames = [
      'id', 'created_at', 'updated_at', 'deleted_at',
      'table_id', 'organization_id', 'user_id', 'field_id',
      'select', 'from', 'where', 'insert', 'update', 'delete',
      'create', 'drop', 'alter', 'index', 'primary', 'foreign'
    ];
    return reservedNames.includes(this._value.toLowerCase());
  }

  /**
   * Get suggested field name if current is invalid
   */
  static getSuggestion(invalidName: string): FieldName {
    if (!invalidName) {
      return new FieldName('untitled_field');
    }

    // Clean up the name
    let suggestion = invalidName
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_')            // Replace spaces with underscores
      .replace(/^[0-9]+/, 'field_')    // Prefix if starts with number
      .substring(0, 64);               // Truncate to max length

    // Ensure it starts with letter or underscore
    if (!suggestion.match(/^[a-zA-Z_]/)) {
      suggestion = `field_${suggestion}`;
    }

    // Ensure it's not empty after cleanup
    if (!suggestion) {
      suggestion = 'untitled_field';
    }

    return new FieldName(suggestion);
  }

  /**
   * Get display name for UI (capitalize and replace underscores with spaces)
   */
  getDisplayName(): string {
    return this._value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Check if field name matches a pattern
   */
  matches(pattern: RegExp): boolean {
    return pattern.test(this._value);
  }

  equals(other: FieldName): boolean {
    return this._value.toLowerCase() === other._value.toLowerCase();
  }

  toString(): string {
    return this._value;
  }
}