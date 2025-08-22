// AIDEV-NOTE: Team repository interface
// Defines data access operations for Team entities

import type { Team } from '../entities/team';

export interface ITeamRepository {
  /**
   * Find teams by organization ID
   */
  findByOrganization(organizationId: number): Promise<Team[]>;

  /**
   * Find team by ID
   */
  findById(id: number): Promise<Team | null>;

  /**
   * Find teams by agent ID
   */
  findByAgentId(agentId: string): Promise<Team[]>;

  /**
   * Save team
   */
  save(team: Team): Promise<void>;

  /**
   * Delete team
   */
  delete(id: number): Promise<void>;

  /**
   * Count teams by organization
   */
  countByOrganization(organizationId: number): Promise<number>;
}