// AIDEV-NOTE: AppName Value Object - validates supported apps and handles normalization
// Encapsulates business rules about which external services are supported

export class AppName {
  private static readonly VALID_APPS = [
    'gmail', 'slack', 'github', 'google-sheets', 
    'discord', 'twitter', 'notion', 'trello'
  ] as const;
  
  // Business rule: Normalize various Google services to expected app names
  private static readonly APP_NORMALIZATIONS = {
    'google': 'gmail',
    'google_gmail': 'gmail',
    'google-drive': 'google-sheets',
    'google_drive': 'google-sheets'
  } as const;
  
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
    
    const normalized = AppName.APP_NORMALIZATIONS[value as keyof typeof AppName.APP_NORMALIZATIONS] || value;
    return new AppName(normalized as any);
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