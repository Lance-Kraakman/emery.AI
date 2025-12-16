/**
 * Trigger Matching Service
 *
 * Domain service for finding agent schedules that match table change events.
 * Used to determine which agents should be triggered when database tables are modified.
 *
 * AIDEV-NOTE: Pure domain service with no infrastructure dependencies.
 * Performance logging should be added in the application layer if needed.
 */

import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ScheduleConfiguration } from '@/ddd/domain/agents/entities/agent';
import type { TableChangeEvent } from '../types/scheduling-types';
import { DatabaseEventTriggerConfig } from '../value-objects/trigger-config';

/**
 * Result of matching a table change event to an agent schedule
 */
export interface MatchedSchedule {
  agent: Agent;
  schedule: ScheduleConfiguration;
  event: TableChangeEvent;
}

/**
 * Service for matching table change events to agent schedules
 */
export interface ITriggerMatchingService {
  /**
   * Find all agent schedules that match a table change event
   *
   * Algorithm:
   * 1. Query all agents in the event's organization
   * 2. Filter agents that have enabled DATABASE_EVENT schedules
   * 3. Match schedules by operation type and table ID
   * 4. Return matched { agent, schedule, event } tuples
   *
   * @param event - The table change event to match against
   * @returns Array of matched schedules with their agents
   */
  findMatchingSchedules(event: TableChangeEvent): Promise<MatchedSchedule[]>;
}

export class TriggerMatchingService implements ITriggerMatchingService {
  constructor(
    private readonly agentRepository: IAgentRepository
  ) {}

  async findMatchingSchedules(event: TableChangeEvent): Promise<MatchedSchedule[]> {
    const startTime = performance.now();

    // Query all agents in the organization
    const agents = await this.agentRepository.findByOrganization(event.organizationId);
    const queryTime = performance.now() - startTime;

    // Find matching schedules across all agents
    const matches: MatchedSchedule[] = [];

    for (const agent of agents) {
      // Skip agents with no schedules
      if (!agent.schedules || agent.schedules.length === 0) {
        continue;
      }

      // Check each schedule for matches
      for (const schedule of agent.schedules) {
        // Only process enabled DATABASE_EVENT triggers
        if (!schedule.enabled || schedule.trigger.type !== 'DATABASE_EVENT') {
          continue;
        }

        const trigger = schedule.trigger as DatabaseEventTriggerConfig;

        // Check if trigger matches the event
        if (this.scheduleMatchesEvent(trigger, event)) {
          matches.push({
            agent,
            schedule,
            event
          });
        }
      }
    }

    const totalTime = performance.now() - startTime;

    // Simple performance logging for MVP (can be enhanced later)
    if (typeof console !== 'undefined') {
      console.log('[TriggerMatchingService] Performance metrics:', {
        organizationId: event.organizationId.value,
        tableId: event.tableId,
        operation: event.operation,
        agentCount: agents.length,
        matchCount: matches.length,
        queryTimeMs: Math.round(queryTime * 100) / 100,
        totalTimeMs: Math.round(totalTime * 100) / 100
      });
    }

    return matches;
  }

  /**
   * Check if a DATABASE_EVENT trigger matches a table change event
   */
  private scheduleMatchesEvent(
    trigger: DatabaseEventTriggerConfig,
    event: TableChangeEvent
  ): boolean {
    // Check operation match
    if (!trigger.matchesOperation(event.operation)) {
      return false;
    }

    // Check table match (null tableId means all tables)
    // Convert number tableId to string for comparison with trigger.tableId (which is string)
    if (!trigger.matchesTable(event.tableId.toString())) {
      return false;
    }

    // TODO: Phase 3 - Implement condition matching
    // For now, we don't evaluate the conditions field
    // if (trigger.conditions) {
    //   return this.evaluateConditions(trigger.conditions, event.rowData);
    // }

    return true;
  }
}
