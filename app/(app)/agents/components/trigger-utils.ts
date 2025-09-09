// AIDEV-NOTE: Type guard utilities for trigger configurations
// Provides type-safe helpers to replace 'as any' casting

import type { 
  TriggerConfig, 
  CalendarTriggerConfig, 
  DatabaseEventTriggerConfig,
  RagReindexTriggerConfig,
  WebhookTriggerConfig 
} from '@/ddd/domain/scheduling/value-objects/trigger-config';

// Type guard functions
export const isCalendarTrigger = (trigger: TriggerConfig): trigger is CalendarTriggerConfig => 
  trigger.type === 'CALENDAR';

export const isDatabaseEventTrigger = (trigger: TriggerConfig): trigger is DatabaseEventTriggerConfig => 
  trigger.type === 'DATABASE_EVENT';

export const isRagReindexTrigger = (trigger: TriggerConfig): trigger is RagReindexTriggerConfig => 
  trigger.type === 'RAG_REINDEX';

export const isWebhookTrigger = (trigger: TriggerConfig): trigger is WebhookTriggerConfig => 
  trigger.type === 'WEBHOOK';

// Safe property access helpers
export const getCalendarRRule = (trigger: TriggerConfig): string | undefined => 
  isCalendarTrigger(trigger) ? trigger.rrule : undefined;

export const getDatabaseEventOperations = (trigger: TriggerConfig): ('INSERT' | 'UPDATE' | 'DELETE')[] => 
  isDatabaseEventTrigger(trigger) ? trigger.operations : [];

export const getRagReindexDebounceMs = (trigger: TriggerConfig): number | undefined => 
  isRagReindexTrigger(trigger) ? trigger.debounceMs : undefined;

export const getWebhookSecret = (trigger: TriggerConfig): string | undefined => 
  isWebhookTrigger(trigger) ? trigger.webhookSecret : undefined;

export const getWebhookRequiresSignature = (trigger: TriggerConfig): boolean => 
  isWebhookTrigger(trigger) ? trigger.requiresSignature || false : false;

// Human-readable trigger type labels
export const getTriggerTypeLabel = (triggerType: TriggerConfig['type']): string => {
  switch (triggerType) {
    case 'MANUAL':
      return 'Manual Execution';
    case 'CALENDAR':
      return 'Scheduled/Calendar';
    case 'DATABASE_EVENT':
      return 'Database Changes';
    case 'RAG_REINDEX':
      return 'RAG Reindexing';
    case 'WEBHOOK':
      return 'Webhook Trigger';
    default:
      return 'Unknown';
  }
};