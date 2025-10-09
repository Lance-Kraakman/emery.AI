// AIDEV-NOTE: AppName Value Object - validates supported apps and handles normalization
// Now uses database as source of truth instead of hardcoded list
// AIDEV-TODO: Consider caching valid apps to avoid excessive database queries

export class AppName {
  // AIDEV-NOTE: Removed hardcoded VALID_APPS - apps are now loaded from database
  // The app_types table is the source of truth for supported apps

  constructor(private readonly _value: string) {
    // Basic validation only - detailed validation happens in fromString
    if (!this._value || typeof this._value !== 'string') {
      throw new Error('App name must be a non-empty string');
    }
  }

  get value(): string {
    return this._value;
  }

  static fromString(value: string): AppName {
    if (!value || typeof value !== 'string') {
      throw new Error('App name must be a non-empty string');
    }

    // Simple normalization - lowercase and trim
    const normalizedValue = value.toLowerCase().trim();

    // AIDEV-NOTE: Validation against database happens at the service layer
    // The value object now focuses on representing the app name, not validating it
    // This prevents circular dependencies and keeps the domain layer clean
    return new AppName(normalizedValue);
  }

  static getAllSupported(): readonly string[] {
    // AIDEV-NOTE: This method is deprecated - use getAvailableApps() action instead
    // Keeping for backward compatibility but should not be used for validation
    console.warn('[AppName] getAllSupported() is deprecated. Use getAvailableApps() server action instead.');
    return [];
  }

  equals(other: AppName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}