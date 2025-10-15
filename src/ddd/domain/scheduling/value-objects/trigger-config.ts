/**
 * Trigger Configuration Value Objects for Agent Scheduling
 * 
 * DDD Value Objects that represent different ways agents can be triggered to execute tasks.
 * Each trigger type is a proper Value Object with validation, equality, and helper methods.
 * 
 * AIDEV-NOTE: RAG_REINDEX is handled as a system trigger, not user-configurable agent trigger
 */

import { RRule } from 'rrule';

export type TriggerType = 'MANUAL' | 'CALENDAR' | 'DATABASE_EVENT' | 'WEBHOOK';
export type DatabaseOperation = 'INSERT' | 'UPDATE' | 'DELETE';

// AIDEV-NOTE: Base class for all trigger configurations with common validation
export abstract class BaseTriggerConfig {
  protected constructor(
    public readonly type: TriggerType,
    public readonly enabled: boolean = true,
    public readonly description?: string
  ) {
    if (!type) {
      throw new Error('Trigger type is required');
    }
  }

  abstract equals(other: BaseTriggerConfig): boolean;
  abstract validate(): void;
  abstract toJSON(): Record<string, any>;

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getType(): TriggerType {
    return this.type;
  }
}

// Manual trigger - executed on-demand by users
export class ManualTriggerConfig extends BaseTriggerConfig {
  constructor(
    enabled: boolean = true,
    description?: string
  ) {
    super('MANUAL', enabled, description);
    this.validate();
  }

  validate(): void {
    // Manual triggers don't need additional validation
  }

  equals(other: BaseTriggerConfig): boolean {
    return other instanceof ManualTriggerConfig &&
           this.enabled === other.enabled &&
           this.description === other.description;
  }

  toJSON(): Record<string, any> {
    return {
      type: this.type,
      enabled: this.enabled,
      description: this.description
    };
  }

  static fromJSON(data: any): ManualTriggerConfig {
    return new ManualTriggerConfig(
      data.enabled,
      data.description
    );
  }
}

// Calendar/CRON-based trigger - scheduled execution
export class CalendarTriggerConfig extends BaseTriggerConfig {
  private _parsedRule?: RRule;

  constructor(
    public readonly rrule: string,
    public readonly timezone: string = 'UTC',
    public readonly startDate: Date = new Date(),
    public readonly endDate?: Date,
    enabled: boolean = true,
    description?: string
  ) {
    super('CALENDAR', enabled, description);
    this.validate();
  }

  validate(): void {
    if (!this.rrule || this.rrule.trim().length === 0) {
      throw new Error('RRule is required for Calendar triggers');
    }
    
    try {
      this._parsedRule = RRule.fromString(this.rrule);
    } catch (error) {
      throw new Error(`Invalid RRule string: ${this.rrule}. ${error}`);
    }

    if (this.endDate && this.endDate <= this.startDate) {
      throw new Error('End date must be after start date');
    }
  }

  equals(other: BaseTriggerConfig): boolean {
    return other instanceof CalendarTriggerConfig &&
           this.enabled === other.enabled &&
           this.rrule === other.rrule &&
           this.timezone === other.timezone &&
           this.startDate.getTime() === other.startDate.getTime() &&
           ((this.endDate && other.endDate && this.endDate.getTime() === other.endDate.getTime()) ||
            (!this.endDate && !other.endDate)) &&
           this.description === other.description;
  }

  toJSON(): Record<string, any> {
    return {
      type: this.type,
      enabled: this.enabled,
      rrule: this.rrule,
      timezone: this.timezone,
      startDate: this.startDate.toISOString(),
      endDate: this.endDate?.toISOString(),
      description: this.description
    };
  }

  // Helper methods for working with RRule
  public getNextOccurrence(from: Date = new Date()): Date | null {
    if (!this._parsedRule) return null;
    
    const next = this._parsedRule.after(from);
    return next || null;
  }

  public getOccurrencesBetween(start: Date, end: Date): Date[] {
    if (!this._parsedRule) return [];
    
    return this._parsedRule.between(start, end);
  }

  public getParsedRule(): RRule | undefined {
    return this._parsedRule;
  }

  static fromJSON(data: any): CalendarTriggerConfig {
    return new CalendarTriggerConfig(
      data.rrule,
      data.timezone || 'UTC',
      data.startDate ? new Date(data.startDate) : new Date(),
      data.endDate ? new Date(data.endDate) : undefined,
      data.enabled,
      data.description
    );
  }
}

// Database event trigger - responds to table changes
export class DatabaseEventTriggerConfig extends BaseTriggerConfig {
  constructor(
    public readonly operations: DatabaseOperation[],
    public readonly tableId?: string,
    public readonly conditions?: Record<string, any>,
    enabled: boolean = true,
    description?: string
  ) {
    super('DATABASE_EVENT', enabled, description);
    this.validate();
  }

  validate(): void {
    if (!this.operations || this.operations.length === 0) {
      throw new Error('At least one database operation must be specified');
    }

    const validOperations: DatabaseOperation[] = ['INSERT', 'UPDATE', 'DELETE'];
    for (const op of this.operations) {
      if (!validOperations.includes(op)) {
        throw new Error(`Invalid database operation: ${op}. Must be one of: ${validOperations.join(', ')}`);
      }
    }

    // Validate tableId format if provided
    if (this.tableId && !/^[a-zA-Z0-9_-]+$/.test(this.tableId)) {
      throw new Error('Table ID must contain only alphanumeric characters, hyphens, and underscores');
    }
  }

  equals(other: BaseTriggerConfig): boolean {
    return other instanceof DatabaseEventTriggerConfig &&
           this.enabled === other.enabled &&
           JSON.stringify(this.operations.sort()) === JSON.stringify(other.operations.sort()) &&
           this.tableId === other.tableId &&
           JSON.stringify(this.conditions) === JSON.stringify(other.conditions) &&
           this.description === other.description;
  }

  toJSON(): Record<string, any> {
    return {
      type: this.type,
      enabled: this.enabled,
      operations: this.operations,
      tableId: this.tableId,
      conditions: this.conditions,
      description: this.description
    };
  }

  public matchesOperation(operation: DatabaseOperation): boolean {
    return this.operations.includes(operation);
  }

  public matchesTable(tableId: string): boolean {
    return !this.tableId || this.tableId === tableId;
  }

  static fromJSON(data: any): DatabaseEventTriggerConfig {
    return new DatabaseEventTriggerConfig(
      data.operations,
      data.tableId,
      data.conditions,
      data.enabled,
      data.description
    );
  }
}

// Webhook trigger - responds to external HTTP calls
export class WebhookTriggerConfig extends BaseTriggerConfig {
  constructor(
    public readonly webhookSecret?: string,
    public readonly allowedOrigins: string[] = [],
    public readonly requiresSignature: boolean = true,
    enabled: boolean = true,
    description?: string
  ) {
    super('WEBHOOK', enabled, description);
    this.validate();
  }

  validate(): void {
    if (this.requiresSignature && (!this.webhookSecret || this.webhookSecret.trim().length === 0)) {
      throw new Error('Webhook secret is required when signature verification is enabled');
    }

    if (this.webhookSecret && this.webhookSecret.length < 16) {
      throw new Error('Webhook secret must be at least 16 characters long');
    }

    // Validate allowed origins format
    for (const origin of this.allowedOrigins) {
      try {
        new URL(origin);
      } catch {
        // Allow wildcard patterns
        if (!origin.includes('*')) {
          throw new Error(`Invalid origin format: ${origin}`);
        }
      }
    }
  }

  equals(other: BaseTriggerConfig): boolean {
    return other instanceof WebhookTriggerConfig &&
           this.enabled === other.enabled &&
           this.webhookSecret === other.webhookSecret &&
           JSON.stringify(this.allowedOrigins.sort()) === JSON.stringify(other.allowedOrigins.sort()) &&
           this.requiresSignature === other.requiresSignature &&
           this.description === other.description;
  }

  toJSON(): Record<string, any> {
    return {
      type: this.type,
      enabled: this.enabled,
      webhookSecret: this.webhookSecret,
      allowedOrigins: this.allowedOrigins,
      requiresSignature: this.requiresSignature,
      description: this.description
    };
  }

  public isOriginAllowed(origin: string): boolean {
    if (this.allowedOrigins.length === 0) return true; // Allow all if none specified
    
    return this.allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed.includes('*')) {
        // Simple wildcard matching
        const pattern = allowed.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });
  }

  static fromJSON(data: any): WebhookTriggerConfig {
    return new WebhookTriggerConfig(
      data.webhookSecret,
      data.allowedOrigins || [],
      data.requiresSignature !== false, // Default to true
      data.enabled,
      data.description
    );
  }
}

export type TriggerConfig = 
  | ManualTriggerConfig 
  | CalendarTriggerConfig 
  | DatabaseEventTriggerConfig 
  | WebhookTriggerConfig;

// Factory functions for creating trigger configurations
export const TriggerConfigs = {
  manual: (enabled: boolean = true, description?: string): ManualTriggerConfig => {
    return new ManualTriggerConfig(enabled, description);
  },

  calendar: (rrule: string, options?: {
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
    enabled?: boolean;
    description?: string;
  }): CalendarTriggerConfig => {
    return new CalendarTriggerConfig(
      rrule,
      options?.timezone || 'UTC',
      options?.startDate || new Date(),
      options?.endDate,
      options?.enabled !== false, // Default to true
      options?.description
    );
  },

  databaseEvent: (operations: DatabaseOperation[], options?: {
    tableId?: string;
    conditions?: Record<string, any>;
    enabled?: boolean;
    description?: string;
  }): DatabaseEventTriggerConfig => {
    return new DatabaseEventTriggerConfig(
      operations,
      options?.tableId,
      options?.conditions,
      options?.enabled !== false, // Default to true
      options?.description
    );
  },

  webhook: (options?: {
    webhookSecret?: string;
    allowedOrigins?: string[];
    requiresSignature?: boolean;
    enabled?: boolean;
    description?: string;
  }): WebhookTriggerConfig => {
    return new WebhookTriggerConfig(
      options?.webhookSecret,
      options?.allowedOrigins || [],
      options?.requiresSignature !== false, // Default to true
      options?.enabled !== false, // Default to true
      options?.description
    );
  }
};

// Helper function to deserialize TriggerConfig from JSON
export function TriggerConfigFromJSON(data: any): TriggerConfig {
  if (!data || !data.type) {
    throw new Error('Invalid trigger config data');
  }

  switch (data.type) {
    case 'MANUAL':
      return ManualTriggerConfig.fromJSON(data);
    case 'CALENDAR':
      return CalendarTriggerConfig.fromJSON(data);
    case 'DATABASE_EVENT':
      return DatabaseEventTriggerConfig.fromJSON(data);
    case 'WEBHOOK':
      return WebhookTriggerConfig.fromJSON(data);
    default:
      throw new Error(`Unknown trigger type: ${data.type}`);
  }
}