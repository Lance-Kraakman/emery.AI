// AIDEV-NOTE: Agent repository interface
// Defines data access operations for Agent entities

import type { Agent } from '../entities/agent';

export interface IAgentRepository {
  /**
   * Find agents by organization ID
   */
  findByOrganization(organizationId: number): Promise<Agent[]>;

  /**
   * Find agent by ID
   */
  findById(id: number): Promise<Agent | null>;

  /**
   * Find agents by owner ID
   */
  findByOwner(ownerId: string): Promise<Agent[]>;

  /**
   * Find active agents by organization
   */
  findActiveByOrganization(organizationId: number): Promise<Agent[]>;

  /**
   * Save agent
   */
  save(agent: Agent): Promise<void>;

  /**
   * Delete agent
   */
  delete(id: number): Promise<void>;

  /**
   * Count agents by organization
   */
  countByOrganization(organizationId: number): Promise<number>;
}