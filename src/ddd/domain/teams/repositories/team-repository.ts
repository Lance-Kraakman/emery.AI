// AIDEV-NOTE: Team repository interface
// Defines data access operations for Team entities

import type { Team } from '../entities/team';
import { TeamId, OrganizationId, AgentId } from '@/src/ddd/domain/shared/value-objects';

// Data transfer objects for repository operations
export interface CreateTeamData {
  name: string;
  purpose?: string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  goals?: string[] | null;
  agentIds?: string[] | null;
  databaseId?: string | null;
  organizationId: number;
}

export interface UpdateTeamData extends Partial<CreateTeamData> {}

export interface ITeamRepository {
  /**
   * Create a new team
   */
  create(data: CreateTeamData): Promise<Team>;

  /**
   * Update an existing team
   */
  update(id: TeamId, data: UpdateTeamData): Promise<Team>;

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
   * Delete team
   */
  delete(id: TeamId): Promise<void>;

  /**
   * Count teams by organization
   */
  countByOrganization(organizationId: OrganizationId): Promise<number>;
}