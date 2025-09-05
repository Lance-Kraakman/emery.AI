// AIDEV-NOTE: Team repository interface
// Defines data access operations for Team entities

import type { Team } from '../entities/team';
import { TeamId, OrganizationId, AgentId } from '@/ddd/domain/shared/value-objects';
import type { TeamTaskPermissions } from '@/ddd/application/services/teams/team-permissions-application-service';

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
   * Save team
   */
  save(team: Team): Promise<void>;

  /**
   * Delete team
   */
  delete(id: TeamId): Promise<void>;

  /**
   * Count teams by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;

  /**
   * Update team task permissions
   */
  updateTaskPermissions(id: TeamId, permissions: TeamTaskPermissions): Promise<void>;

  /**
   * Get team task permissions
   */
  getTaskPermissions(id: TeamId): Promise<TeamTaskPermissions | null>;
}