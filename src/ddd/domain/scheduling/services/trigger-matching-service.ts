/**
 * Trigger Matching Service
 *
 * Domain service for finding agent automations that match table change events.
 * Used to determine which agents should be triggered when database tables are modified.
 *
 * AIDEV-NOTE: Pure domain service with no infrastructure dependencies.
 * Performance logging should be added in the application layer if needed.
 */

import type { Agent, AutomationConfiguration } from '@/ddd/domain/agents/entities/agent';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { TableChangeEvent } from '../types/scheduling-types';
import { DatabaseEventTriggerConfig } from '../value-objects/trigger-config';

/**
 * Result of matching a table change event to an agent automation
 */
export interface MatchedAutomation {
  agent: Agent;
  automation: AutomationConfiguration;
  event: TableChangeEvent;
}

/**
 * Service for matching table change events to agent automations
 */
export interface ITriggerMatchingService {
  /**
   * Find all agent automations that match a table change event
   *
   * Algorithm:
   * 1. Query all agents in the event's organization
   * 2. Filter agents that have enabled DATABASE_EVENT automations
   * 3. Match automations by operation type and table ID
   * 4. Return matched { agent, automation, event } tuples
   *
   * @param event - The table change event to match against
   * @returns Array of matched automations with their agents
   */
  findMatchingAutomations(event: TableChangeEvent): Promise<MatchedAutomation[]>;
}

export class TriggerMatchingService implements ITriggerMatchingService {
  constructor(
    private readonly agentRepository: IAgentRepository
  ) {}

  async findMatchingAutomations(event: TableChangeEvent): Promise<MatchedAutomation[]> {
    const startTime = performance.now();

    // Query all agents in the organization
    const agents = await this.agentRepository.findByOrganization(event.organizationId);
    const queryTime = performance.now() - startTime;

    // Find matching automations across all agents
    const matches: MatchedAutomation[] = [];

    for (const agent of agents) {
      // Skip agents with no automations
      if (!agent.automations || agent.automations.length === 0) {
        continue;
      }

      // Check each automation for matches
      for (const automation of agent.automations) {
        // Only process enabled DATABASE_EVENT triggers
        if (!automation.enabled || automation.trigger.type !== 'DATABASE_EVENT') {
          continue;
        }

        const trigger = automation.trigger as DatabaseEventTriggerConfig;

        // Check if trigger matches the event
        if (this.automationMatchesEvent(trigger, event)) {
          matches.push({
            agent,
            automation,
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
  private automationMatchesEvent(
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
