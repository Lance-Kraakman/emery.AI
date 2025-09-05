// AIDEV-NOTE: Agent repository interface
// Defines data access operations for Agent entities

import type { Agent } from '../entities/agent';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { AgentTaskPermissions } from '@/ddd/application/services/agents/agent-permissions-application-service';

export interface IAgentRepository {
  /**
   * Find agents by organization ID
   */
  findByOrganization(organizationId: OrganizationId): Promise<Agent[]>;

  /**
   * Find agent by ID
   */
  findById(id: AgentId): Promise<Agent | null>;

  /**
   * Find agents by owner ID
   */
  findByOwner(ownerId: UserId): Promise<Agent[]>;

  /**
   * Find active agents by organization
   */
  findActiveByOrganization(organizationId: OrganizationId): Promise<Agent[]>;

  /**
   * Save agent (returns the saved agent with updated ID for new entities)
   */
  save(agent: Agent): Promise<Agent>;

  /**
   * Delete agent
   */
  delete(id: AgentId): Promise<void>;

  /**
   * Count agents by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;

  /**
   * Find active agents with trigger configurations for scheduling
   */
  findActiveAgentsWithTriggers(organizationId?: OrganizationId): Promise<Agent[]>;

  /**
   * Find all agents with trigger configurations (active and inactive)
   */
  findAgentsWithTriggers(organizationId?: OrganizationId): Promise<Agent[]>;

  /**
   * Update agent task permissions
   */
  updateTaskPermissions(id: AgentId, permissions: AgentTaskPermissions): Promise<void>;

  /**
   * Get agent task permissions
   */
  getTaskPermissions(id: AgentId): Promise<AgentTaskPermissions | null>;
}