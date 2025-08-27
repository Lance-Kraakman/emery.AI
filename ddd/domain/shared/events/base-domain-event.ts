/**
 * Base Domain Event Interface
 * 
 * Defines the common structure for all domain events in the system.
 * Follows DDD Event Sourcing patterns with proper aggregate identification.
 * 
 * AIDEV-NOTE: Base interface for all domain events - provides consistent
 * event structure across all domain boundaries
 */

export interface BaseDomainEvent {
  readonly eventType: string;
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly aggregateId: string; // Generic aggregate identifier
  readonly aggregateType: string; // Type of aggregate that generated the event
  readonly version: number; // Event schema version for evolution
  readonly data: Record<string, any>; // Event-specific data payload
}

/**
 * Helper function to create domain events with consistent structure
 */
export function createBaseDomainEvent(
  eventType: string,
  aggregateId: string,
  aggregateType: string,
  data: Record<string, any>,
  version: number = 1
): BaseDomainEvent {
  return {
    eventType,
    eventId: crypto.randomUUID(),
    occurredAt: new Date(),
    aggregateId,
    aggregateType,
    version,
    data
  };
}