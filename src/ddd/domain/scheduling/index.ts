/**
 * Scheduling Domain - Public Exports
 * 
 * Main entry point for the scheduling domain
 * Centralized exports for trigger configurations and scheduling types
 */

// Value Objects - Trigger Configurations
export { TriggerConfigs } from './value-objects/trigger-config';
export type {
  TriggerType,
  TriggerConfig,
  CalendarTriggerConfig,
  DatabaseEventTriggerConfig,
  WebhookTriggerConfig
} from './value-objects/trigger-config';

// Common Types - Scheduling Interfaces
export type {
  TaskExecutionRequest,
  ScheduleTaskRequest,
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
  MatchedSchedule
} from './services/trigger-matching-service';