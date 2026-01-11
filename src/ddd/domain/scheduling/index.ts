/**
 * Scheduling Domain - Public Exports
 *
 * Main entry point for the scheduling domain
 * Centralized exports for trigger configurations and scheduling types
 */

// Value Objects - Trigger Configurations
export { TriggerConfigs, TriggerConfigFromJSON } from './value-objects/trigger-config';
export type {
  TriggerType,
  TriggerConfig,
  DatabaseOperation
} from './value-objects/trigger-config';
export {
  BaseTriggerConfig,
  CalendarTriggerConfig,
  DatabaseEventTriggerConfig,
  WebhookTriggerConfig,
  PipedreamEventTriggerConfig
} from './value-objects/trigger-config';

// Common Types - Scheduling Interfaces
export type {
  TaskExecutionRequest,
  AutomationTaskRequest,
  ScheduledTask,
  TaskProcessingStats,
  ExecutionStats,
  CleanupResult,
  RagReindexEvent,
  TaskEvent,
  TableChangeEvent,
  EventDispatcherConfig
} from './types/scheduling-types';

// Domain Services
export { TriggerMatchingService } from './services/trigger-matching-service';
export type {
  ITriggerMatchingService,
  MatchedAutomation
} from './services/trigger-matching-service';
