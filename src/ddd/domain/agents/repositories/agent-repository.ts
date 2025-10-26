// AIDEV-NOTE: Agent repository interface
// Defines data access operations for Agent entities

import type { Agent, CreateAgentData as CreateAgentDataEntity, UpdateAgentData as UpdateAgentDataEntity } from '../entities/agent';
import type { AgentId, OrganizationId, UserId, ApiKey } from '@/ddd/domain/shared/value-objects';

// Re-export for backward compatibility
export type { CreateAgentDataEntity as CreateAgentData, UpdateAgentDataEntity as UpdateAgentData };

export interface IAgentRepository {
  /**
   * Create a new agent
   */
  create(data: CreateAgentDataEntity): Promise<Agent>;

  /**
   * Update an existing agent
   */
  update(id: AgentId, data: UpdateAgentDataEntity): Promise<Agent>;

  /**
   * Find agent by ID
   */
  findById(id: AgentId): Promise<Agent | null>;

  /**
   * Find agents by organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<Agent[]>;

  /**
   * Find agents by owner
   */
  findByOwner(ownerId: UserId, organizationId?: OrganizationId): Promise<Agent[]>;

  /**
   * Find active agents by organization
   */
  findActiveByOrganization(organizationId: OrganizationId): Promise<Agent[]>;

  /**
   * Check if agent name is unique within organization
   */
  isNameUnique(organizationId: OrganizationId, name: string, excludeId?: AgentId): Promise<boolean>;

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
   * Find agent by API key
   */
  findByApiKey(apiKey: ApiKey): Promise<Agent | null>;

  /**
   * Update agent's last used timestamp
   */
  updateLastUsed(id: AgentId): Promise<void>;

}