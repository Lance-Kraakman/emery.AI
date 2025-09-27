// AIDEV-NOTE: AppName Value Object - validates supported apps and handles normalization
// Encapsulates business rules about which external services are supported

export class AppName {
  private static readonly VALID_APPS = [
    'gmail', 'slack', 'github', 'google-sheets', 
    'discord', 'twitter', 'notion', 'trello'
  ] as const;
  
  // Simplified: No complex normalization - apps must use exact names
  
  constructor(private readonly _value: typeof AppName.VALID_APPS[number]) {
    if (!AppName.VALID_APPS.includes(this._value)) {
      throw new Error(
        `Unsupported app: ${this._value}. Supported apps: ${AppName.VALID_APPS.join(', ')}`
      );
    }
  }
  
  get value(): string {
    return this._value;
  }
  
  static fromString(value: string): AppName {
    if (!value || typeof value !== 'string') {
      throw new Error('App name must be a non-empty string');
    }

    // Simple case-insensitive matching without complex normalization
    const lowerValue = value.toLowerCase().trim();

    // Validate the value is supported (exact match required)
    if (!AppName.VALID_APPS.includes(lowerValue as any)) {
      throw new Error(`Unsupported app: ${value}. Supported apps: ${AppName.VALID_APPS.join(', ')}`);
    }

    return new AppName(lowerValue as any);
  }
  
  static getAllSupported(): readonly string[] {
    return AppName.VALID_APPS;
  }
  
  equals(other: AppName): boolean {
    return this._value === other._value;
  }
  
  toString(): string {
    return this._value;
  }
}