// AIDEV-NOTE: Team repository interface
// Defines data access operations for Team entities

import type { Team } from '../entities/team';
import { TeamId, OrganizationId, AgentId } from '@/ddd/domain/shared/value-objects';

export interface ITeamRepository {
  /**
   * Find teams by organization ID
   */
  findByOrganization(organizationId: OrganizationId): Promise<Team[]>;

  /**
   * Find team by ID
   */
  findById(id: TeamId): Promise<Team | null>;

  /**
   * Find teams by agent ID
   */
  findByAgentId(agentId: AgentId): Promise<Team[]>;

  /**
   * Save team - returns saved team with database-generated ID for new teams
   */
  save(team: Team): Promise<Team>;

  /**
   * Delete team
   */
  delete(id: TeamId): Promise<void>;

  /**
   * Count teams by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}