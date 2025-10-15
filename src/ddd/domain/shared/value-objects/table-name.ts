// AIDEV-NOTE: TableName Value Object - encapsulates database table naming conventions
// Ensures table names follow database constraints and organizational standards

export class TableName {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Table name cannot be empty');
    }
    
    const trimmedValue = value.trim();
    if (!this.isValid(trimmedValue)) {
      throw new Error('Invalid table name: must be 1-63 characters, alphanumeric with underscores, cannot start with number');
    }
    
    this._value = trimmedValue;
  }

  get value(): string {
    return this._value;
  }

  private isValid(name: string): boolean {
    // Database table naming rules (PostgreSQL):
    // - 1-63 characters (PostgreSQL limit)
    // - Only alphanumeric and underscores
    // - Cannot start with a number
    // - Case insensitive (normalized to lowercase)
    const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;
    return tableNameRegex.test(name) && name.length >= 1 && name.length <= 63;
  }

  static fromString(value: string): TableName {
    return new TableName(value);
  }

  static isValidTableName(value: string): boolean {
    try {
      new TableName(value);
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
   * Generate full table name with organization prefix
   */
  getFullTableName(organizationId: number): string {
    return `org_${organizationId}_${this.getNormalized()}`;
  }

  /**
   * Check if this is a reserved table name
   */
  isReserved(): boolean {
    const reservedNames = [
      // PostgreSQL reserved
      'user', 'users', 'table', 'tables', 'column', 'columns',
      'index', 'indexes', 'sequence', 'sequences', 'view', 'views',
      'function', 'functions', 'procedure', 'procedures',
      
      // Application reserved
      'organizations', 'agents', 'tasks', 'fields', 'roles',
      'permissions', 'invitations', 'sessions', 'accounts',
      
      // System tables
      'information_schema', 'pg_catalog', 'pg_toast',
      'public', 'schema', 'schemas'
    ];
    return reservedNames.includes(this._value.toLowerCase());
  }

  /**
   * Check if table name suggests it's a system table
   */
  isSystemTable(): boolean {
    const systemPrefixes = ['pg_', 'information_', 'sys_', 'system_'];
    const lowercaseName = this._value.toLowerCase();
    return systemPrefixes.some(prefix => lowercaseName.startsWith(prefix));
  }

  /**
   * Get suggested table name if current is invalid
   */
  static getSuggestion(invalidName: string): TableName {
    if (!invalidName) {
      return new TableName('untitled_table');
    }

    // Clean up the name
    let suggestion = invalidName
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_')            // Replace spaces with underscores
      .replace(/^[0-9]+/, 'table_')    // Prefix if starts with number
      .substring(0, 63);               // Truncate to max length

    // Ensure it starts with letter or underscore
    if (!suggestion.match(/^[a-zA-Z_]/)) {
      suggestion = `table_${suggestion}`;
    }

    // Ensure it's not empty after cleanup
    if (!suggestion) {
      suggestion = 'untitled_table';
    }

    return new TableName(suggestion);
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
   * Get table name with plural form
   */
  getPlural(): string {
    const name = this._value.toLowerCase();
    
    // Simple pluralization rules
    if (name.endsWith('y') && !name.endsWith('ay') && !name.endsWith('ey') && !name.endsWith('oy') && !name.endsWith('uy')) {
      return name.slice(0, -1) + 'ies';
    } else if (name.endsWith('s') || name.endsWith('sh') || name.endsWith('ch') || name.endsWith('x') || name.endsWith('z')) {
      return name + 'es';
    } else {
      return name + 's';
    }
  }

  /**
   * Check if table name matches a pattern
   */
  matches(pattern: RegExp): boolean {
    return pattern.test(this._value);
  }

  equals(other: TableName): boolean {
    return this._value.toLowerCase() === other._value.toLowerCase();
  }

  toString(): string {
    return this._value;
  }
}