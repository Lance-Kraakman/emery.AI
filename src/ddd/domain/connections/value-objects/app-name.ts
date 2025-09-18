// AIDEV-NOTE: AppName Value Object - validates supported apps and handles normalization
// Encapsulates business rules about which external services are supported

export class AppName {
  private static readonly VALID_APPS = [
    'gmail', 'slack', 'github', 'google-sheets', 
    'discord', 'twitter', 'notion', 'trello'
  ] as const;
  
  // Business rule: Normalize various app names from different sources to expected app names
  // AIDEV-NOTE: Enhanced to handle Pipedream variations and common aliases
  private static readonly APP_NORMALIZATIONS = {
    // Google services variations
    'google': 'gmail',
    'google_gmail': 'gmail',
    'google-gmail': 'gmail',
    'googlegmail': 'gmail',
    'google-drive': 'google-sheets',
    'google_drive': 'google-sheets',
    'google-sheets': 'google-sheets',
    'google_sheets': 'google-sheets',
    'googlesheets': 'google-sheets',

    // Common aliases for other services
    'git': 'github',
    'gh': 'github',
    'discord_webhook': 'discord',
    'slack_webhook': 'slack',
    'twitter_v2': 'twitter',
    'x': 'twitter'
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

    // Normalize to lowercase for case-insensitive matching
    const lowerValue = value.toLowerCase().trim();

    // First check direct normalizations (case-insensitive)
    const normalized = AppName.APP_NORMALIZATIONS[lowerValue as keyof typeof AppName.APP_NORMALIZATIONS] || lowerValue;

    // Enhanced debugging for connection status issues
    console.log(`[AppName] Normalizing '${value}' -> '${normalized}'`);

    // Validate the normalized value is supported
    if (!AppName.VALID_APPS.includes(normalized as any)) {
      console.error(`[AppName] Unsupported app after normalization: '${normalized}' (original: '${value}')`);
      console.error(`[AppName] Supported apps: ${AppName.VALID_APPS.join(', ')}`);
      throw new Error(`Unsupported app: ${value} (normalized to: ${normalized}). Supported apps: ${AppName.VALID_APPS.join(', ')}`);
    }

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