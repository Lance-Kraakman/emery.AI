// AIDEV-NOTE: Drizzle implementation of Team repository
// Handles data persistence for Team domain entities

import type { ITeamRepository, CreateTeamData, UpdateTeamData } from '@/ddd/domain/teams/repositories/team-repository';
import { Team } from '@/ddd/domain/teams/entities/team';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import { OrganizationId, TeamId, AgentId } from '@/ddd/domain/shared/value-objects';
import { teams } from '@/ddd/infrastructure/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type TeamRow = InferSelectModel<typeof teams>;

export class DrizzleTeamRepository
  extends DrizzleBaseRepository<Team, TeamId, CreateTeamData, UpdateTeamData, TeamRow>
  implements ITeamRepository {
  
  protected readonly table = teams;
  protected readonly idColumn = teams.id;
  protected readonly organizationColumn = teams.organizationId;

  async create(data: CreateTeamData): Promise<Team> {
    const [record] = await this.db
      .insert(teams)
      .values(data)
      .returning();
    
    return this.fromPersistence(record);
  }
  
  async update(id: TeamId, data: UpdateTeamData): Promise<Team> {
    const [record] = await this.db
      .update(teams)
      .set(data)
      .where(eq(teams.id, id.value))
      .returning();
    
    if (!record) {
      throw new Error(`Team with id ${id.value} not found`);
    }
    
    return this.fromPersistence(record);
  }

  // Inherits findById from base class
  // Inherits findByOrganization from base class
  // Inherits delete from base class

  async findByAgentId(agentId: AgentId): Promise<Team[]> {
    // Use PostgreSQL array contains operator to find teams that include the agent
    const results = await this.db
      .select()
      .from(teams)
      .where(sql`${teams.agentIds} @> ARRAY[${agentId.value}]::text[]`);

    return results.map((result: TeamRow) => this.fromPersistence(result));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, organizationId.value));

    return result.length;
  }

  protected fromPersistence(record: TeamRow): Team {
    return Team.fromPersistence({
      id: record.id,
      name: record.name,
      purpose: record.purpose,
      description: record.description,
      responsibilities: record.responsibilities,
      goals: record.goals,
      agentIds: record.agentIds,
      databaseId: record.databaseId,
      organizationId: record.organizationId,
      ownerId: record.ownerId,
      createdAt: record.createdAt
    });
  }
  
  protected toPersistence(team: Team): any {
    // Team entity doesn't have a toPersistence method yet,
    // but we can extract the data from the entity
    return {
      id: team.id.value,
      name: team.name,
      purpose: team.purpose,
      description: team.description,
      responsibilities: team.responsibilities,
      goals: team.goals,
      agentIds: team.agentIds?.map(id => id.value.toString()) || null,
      databaseId: team.databaseId,
      organizationId: team.organizationId.value,
      ownerId: team.ownerId.value,
      createdAt: team.createdAt
    };
  }
}