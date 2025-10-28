/**
 * Schedule DTOs - Data Transfer Objects for Schedule Configuration
 *
 * Schedules define automated task creation with full task instructions and tool selection.
 * This follows the same pattern as skill step instructions with @ mention support.
 *
 * AIDEV-NOTE: Proper DTO layer following DDD principles
 * - DTOs are plain objects, JSON-serializable
 * - No business logic
 * - Used for data transfer between UI and backend
 * - Mapped to/from domain objects via ScheduleMapper
 */

import type { TriggerType, DatabaseOperation } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { ToolConfigDTO } from './agent.dto';

/**
 * Task instructions for a schedule
 * Defines WHAT task to create when the schedule triggers
 *
 * Same structure as skill step instructions - supports @ mentions for tools/skills/files
 */
export interface TaskInstructionsDTO {
  instructions: string;           // Full task instructions with @ references
  tools: ToolConfigDTO[];        // Tools selected via @ mentions or UI
  metadata?: Record<string, any>; // Additional task metadata
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
 * Manual trigger DTO
 * Trigger executed on-demand by users or API calls
 */
export interface ManualTriggerConfigDTO extends BaseTriggerConfigDTO {
  type: 'MANUAL';
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
 * Discriminated union of all trigger types
 * TypeScript can narrow the type based on the 'type' field
 */
export type TriggerConfigDTO =
  | ManualTriggerConfigDTO
  | CalendarTriggerConfigDTO
  | DatabaseEventTriggerConfigDTO
  | WebhookTriggerConfigDTO;

/**
 * Complete schedule configuration DTO
 * Combines trigger (WHEN) with task instructions (WHAT)
 *
 * This is the core structure for automated task creation.
 * Each schedule is like a "task template" that gets executed when triggered.
 */
export interface ScheduleConfigurationDTO {
  // WHEN to trigger
  trigger: TriggerConfigDTO;

  // WHAT to execute - full task definition
  taskInstructions: TaskInstructionsDTO;

  // Schedule metadata
  enabled: boolean;
  name?: string;              // Descriptive name (e.g., "Daily Sales Report")
  description?: string;       // Optional additional description
}
