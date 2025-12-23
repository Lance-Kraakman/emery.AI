/**
 * Automation DTOs - Data Transfer Objects for Automation Configuration
 *
 * Automations define trigger + skill reference with input mappings.
 * When a trigger fires, the skill is executed with mapped inputs.
 *
 * AIDEV-NOTE: Replaces old ScheduleConfiguration which had inline task instructions
 * - Automations reference skills by ID
 * - Skills determine execution type (agent, operation, tool, write)
 * - Input mappings wire trigger payload to skill inputs
 */

import type { TriggerType, DatabaseOperation } from '@/ddd/domain/scheduling/value-objects/trigger-config';

/**
 * Maps a field from the trigger payload to a skill input
 */
export interface AutomationInputMappingDTO {
  triggerField: string;              // Path in trigger payload: "data.from", "rowData.email"
  skillInputName: string;            // Skill input name to map to
}

/**
 * Base trigger configuration DTO
 * Common fields across all trigger types
 */
interface BaseTriggerConfigDTO {
  type: TriggerType;
  enabled: boolean;
  description?: string;
}

/**
 * Calendar trigger DTO
 * Scheduled execution based on RRULE (iCalendar recurrence rule)
 */
export interface CalendarTriggerConfigDTO extends BaseTriggerConfigDTO {
  type: 'CALENDAR';
  rrule: string;                    // iCalendar recurrence rule
  timezone: string;                 // IANA timezone (e.g., "America/New_York")
  startDate: string;                // ISO 8601 date string
  endDate?: string;                 // Optional end date (ISO 8601)
}

/**
 * Database event trigger DTO
 * Responds to database table operations (INSERT, UPDATE, DELETE)
 */
export interface DatabaseEventTriggerConfigDTO extends BaseTriggerConfigDTO {
  type: 'DATABASE_EVENT';
  operations: DatabaseOperation[];  // Which operations to trigger on
  tableId?: string;                 // Specific table to monitor (optional = all tables)
  conditions?: Record<string, any>; // Optional filtering conditions
}

/**
 * Webhook trigger DTO
 * Responds to external HTTP requests with security validation
 */
export interface WebhookTriggerConfigDTO extends BaseTriggerConfigDTO {
  type: 'WEBHOOK';
  webhookSecret?: string;           // Secret for signature verification
  allowedOrigins: string[];         // CORS allowed origins (supports wildcards)
  requiresSignature: boolean;       // Whether signature verification is required
}

/**
 * Pipedream event trigger DTO
 * Responds to external events via Pipedream Connect event sources
 */
export interface PipedreamEventTriggerConfigDTO extends BaseTriggerConfigDTO {
  type: 'PIPEDREAM_EVENT';
  connectionId: string;              // User's OAuth connection ID
  triggerType: string;               // 'new-email', 'new-message-in-channel', etc.
  props?: Record<string, any>;       // Trigger-specific config (labels, channel, etc.)

  // Set after Pipedream API creates resources:
  pipedreamSourceId?: string;
  pipedreamWebhookId?: string;
  pipedreamSubscriptionId?: string;
}

/**
 * Discriminated union of all trigger types
 * TypeScript can narrow the type based on the 'type' field
 */
export type TriggerConfigDTO =
  | CalendarTriggerConfigDTO
  | DatabaseEventTriggerConfigDTO
  | WebhookTriggerConfigDTO
  | PipedreamEventTriggerConfigDTO;

/**
 * Complete automation configuration DTO
 * Combines trigger (WHEN) with skill reference (WHAT)
 *
 * AIDEV-NOTE: Replaces ScheduleConfigurationDTO
 * - skillId instead of inline taskInstructions
 * - inputMappings to wire trigger payload to skill inputs
 */
export interface AutomationConfigurationDTO {
  // WHEN to trigger
  trigger: TriggerConfigDTO;

  // WHAT to execute - reference to skill
  skillId: number;

  // HOW to map trigger data to skill inputs
  inputMappings?: AutomationInputMappingDTO[];

  // Automation metadata
  enabled: boolean;
  name?: string;              // Descriptive name (e.g., "Sync Gmail to Table")
  description?: string;       // Optional additional description
}
