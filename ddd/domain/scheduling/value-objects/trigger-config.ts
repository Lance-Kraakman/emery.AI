/**
 * Trigger Configuration Value Objects for Agent Scheduling
 * 
 * Represents different ways agents can be triggered to execute tasks
 */

export type TriggerType = 'MANUAL' | 'CALENDAR' | 'DATABASE_EVENT' | 'RAG_REINDEX' | 'WEBHOOK';

export interface BaseTriggerConfig {
  type: TriggerType;
  enabled?: boolean;
  description?: string;
}

// Manual trigger - executed on-demand by users
export interface ManualTriggerConfig extends BaseTriggerConfig {
  type: 'MANUAL';
  requiresAuthentication?: boolean;
}

// Calendar/CRON-based trigger - scheduled execution
export interface CalendarTriggerConfig extends BaseTriggerConfig {
  type: 'CALENDAR';
  rrule?: string;                     // RRule string for complex scheduling
  timezone?: string;                  // Timezone for schedule evaluation
  startDate?: Date;                   // Schedule start date
  endDate?: Date;                     // Schedule end date (optional)
}

// Database event trigger - responds to table changes
export interface DatabaseEventTriggerConfig extends BaseTriggerConfig {
  type: 'DATABASE_EVENT';
  tableId?: string;                   // Specific table to monitor (optional)
  operations: ('INSERT' | 'UPDATE' | 'DELETE')[]; // Which operations trigger execution
  conditions?: Record<string, any>;   // Additional filtering conditions
}

// RAG reindex trigger - responds to data changes requiring reindexing
export interface RagReindexTriggerConfig extends BaseTriggerConfig {
  type: 'RAG_REINDEX';
  domainTypes?: string[];             // Which domain types trigger reindexing
  debounceMs?: number;               // Debounce delay for batch processing
}

// Webhook trigger - responds to external HTTP calls
export interface WebhookTriggerConfig extends BaseTriggerConfig {
  type: 'WEBHOOK';
  webhookSecret?: string;            // Secret for webhook verification
  allowedOrigins?: string[];         // Allowed request origins
  requiresSignature?: boolean;       // Require HMAC signature verification
}

export type TriggerConfig = 
  | ManualTriggerConfig 
  | CalendarTriggerConfig 
  | DatabaseEventTriggerConfig 
  | RagReindexTriggerConfig 
  | WebhookTriggerConfig;

// Factory functions for creating trigger configurations
export const TriggerConfigs = {
  manual: (config?: Partial<ManualTriggerConfig>): ManualTriggerConfig => ({
    type: 'MANUAL',
    enabled: true,
    requiresAuthentication: true,
    ...config
  }),

  calendar: (rrule: string, config?: Partial<CalendarTriggerConfig>): CalendarTriggerConfig => ({
    type: 'CALENDAR',
    enabled: true,
    rrule,
    timezone: 'UTC',
    startDate: new Date(),
    ...config
  }),

  databaseEvent: (operations: ('INSERT' | 'UPDATE' | 'DELETE')[], config?: Partial<DatabaseEventTriggerConfig>): DatabaseEventTriggerConfig => ({
    type: 'DATABASE_EVENT',
    enabled: true,
    operations,
    ...config
  }),

  ragReindex: (config?: Partial<RagReindexTriggerConfig>): RagReindexTriggerConfig => ({
    type: 'RAG_REINDEX',
    enabled: true,
    debounceMs: 5000,
    ...config
  }),

  webhook: (config?: Partial<WebhookTriggerConfig>): WebhookTriggerConfig => ({
    type: 'WEBHOOK',
    enabled: true,
    requiresSignature: true,
    ...config
  })
};