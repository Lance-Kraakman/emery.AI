// AIDEV-NOTE: OrganizationName Value Object - encapsulates business name validation
// Ensures organization names meet business requirements and standards

export class OrganizationName {
  private readonly _value: string;

  constructor(value: string) {
    if (!value) {
      throw new Error('Organization name cannot be empty');
    }
    
    const trimmedValue = value.trim();
    if (!this.isValid(trimmedValue)) {
      throw new Error('Invalid organization name: must be 1-100 characters, cannot contain only whitespace or special characters');
    }
    
    this._value = trimmedValue;
  }

  get value(): string {
    return this._value;
  }

  private isValid(name: string): boolean {
    // Organization name validation rules:
    // - 1-100 characters
    // - Must contain at least one alphanumeric character
    // - Cannot be only whitespace or special characters
    // - Allows spaces, hyphens, apostrophes, periods, commas
    if (name.length < 1 || name.length > 100) {
      return false;
    }

    // Must contain at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(name)) {
      return false;
    }

    // Only allow reasonable business name characters
    const validCharsRegex = /^[a-zA-Z0-9\s\-'.&,()]+$/;
    return validCharsRegex.test(name);
  }

  static fromString(value: string): OrganizationName {
    return new OrganizationName(value);
  }

  static isValidOrganizationName(value: string): boolean {
    try {
      new OrganizationName(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get normalized version (consistent spacing and capitalization)
   */
  getNormalized(): string {
    return this._value
      .replace(/\s+/g, ' ')                    // Normalize whitespace
      .replace(/\b\w/g, char => char.toUpperCase()); // Title case
  }

  /**
   * Get URL-friendly slug
   */
  getSlug(): string {
    return this._value
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s-]/g, '')        // Remove special chars except spaces and hyphens
      .replace(/\s+/g, '-')                    // Replace spaces with hyphens
      .replace(/-+/g, '-')                     // Normalize multiple hyphens
      .replace(/^-|-$/g, '');                  // Remove leading/trailing hyphens
  }

  /**
   * Get database-friendly identifier
   */
  getDatabaseIdentifier(): string {
    return this._value
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '_')          // Replace non-alphanumeric with underscores
      .replace(/_+/g, '_')                     // Normalize multiple underscores
      .replace(/^_|_$/g, '')                   // Remove leading/trailing underscores
      .substring(0, 50);                       // Limit length for database usage
  }

  /**
   * Get suggested organization name if current is invalid
   */
  static getSuggestion(invalidName: string): OrganizationName {
    if (!invalidName) {
      return new OrganizationName('Untitled Organization');
    }

    // Clean up the name
    let suggestion = invalidName
      .trim()
      .replace(/[^a-zA-Z0-9\s\-'.&,()]/g, '') // Remove invalid special chars
      .replace(/\s+/g, ' ')                    // Normalize whitespace
      .substring(0, 100);                      // Truncate to max length

    // Ensure it has at least one alphanumeric character
    if (!/[a-zA-Z0-9]/.test(suggestion)) {
      suggestion = `Organization ${suggestion}`.trim();
    }

    // Ensure it's not empty after cleanup
    if (!suggestion || suggestion.length === 0) {
      suggestion = 'Untitled Organization';
    }

    return new OrganizationName(suggestion);
  }

  /**
   * Get initials for avatar/display
   */
  getInitials(): string {
    return this._value
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3); // Max 3 characters
  }

  /**
   * Check if name contains specific words
   */
  contains(searchTerm: string): boolean {
    return this._value.toLowerCase().includes(searchTerm.toLowerCase());
  }

  /**
   * Get abbreviated version for display in limited space
   */
  getAbbreviated(maxLength: number = 20): string {
    if (this._value.length <= maxLength) {
      return this._value;
    }

    // Try to abbreviate at word boundaries
    const words = this._value.split(' ');
    if (words.length > 1) {
      let abbreviated = words[0];
      for (let i = 1; i < words.length && abbreviated.length + words[i].length + 1 <= maxLength - 3; i++) {
        abbreviated += ' ' + words[i];
      }
      return abbreviated + '...';
    }

    // Single word, truncate with ellipsis
    return this._value.substring(0, maxLength - 3) + '...';
  }

  equals(other: OrganizationName): boolean {
    return this._value.toLowerCase() === other._value.toLowerCase();
  }

  toString(): string {
    return this._value;
  }
}