// AIDEV-NOTE: Agent repository interface
// Defines data access operations for Agent entities

import type { Agent } from '../entities/agent';
import type { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Data transfer objects for repository operations
export interface CreateAgentData {
  name: string;
  type: string;
  description?: string | null;
  instructions?: any | null;
  capabilities?: string[] | null;
  organizationId: number;
  ownerId: string;
  isActive?: boolean;
  trigger?: any | null;
}

export interface UpdateAgentData {
  name?: string;
  type?: string;
  description?: string | null;
  instructions?: any | null;
  capabilities?: string[] | null;
  isActive?: boolean;
  trigger?: any | null;
  apiKey?: string;
  status?: string;
}

export interface IAgentRepository {
  /**
   * Create a new agent
   */
  create(data: CreateAgentData): Promise<Agent>;

  /**
   * Update an existing agent
   */
  update(id: AgentId, data: UpdateAgentData): Promise<Agent>;

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

}