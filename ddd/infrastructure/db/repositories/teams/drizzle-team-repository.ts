// AIDEV-NOTE: Drizzle implementation of Team repository
// Handles data persistence for Team domain entities

import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import { Team } from '@/ddd/domain/teams/entities/team';
import type { DbClient } from '@/lib/db/client';
import { teams } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export class DrizzleTeamRepository implements ITeamRepository {
  constructor(private readonly db: DbClient) {}

  async findByOrganization(organizationId: number): Promise<Team[]> {
    const results = await this.db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId));

    return results.map(result => Team.fromPersistence({
      id: result.id,
      name: result.name,
      purpose: result.purpose,
      description: result.description,
      responsibilities: result.responsibilities,
      goals: result.goals,
      agentIds: result.agentIds,
      databaseId: result.databaseId,
      organizationId: result.organizationId,
      createdAt: result.createdAt
    }));
  }

  async findById(id: number): Promise<Team | null> {
    const results = await this.db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const result = results[0];
    return Team.fromPersistence({
      id: result.id,
      name: result.name,
      purpose: result.purpose,
      description: result.description,
      responsibilities: result.responsibilities,
      goals: result.goals,
      agentIds: result.agentIds,
      databaseId: result.databaseId,
      organizationId: result.organizationId,
      createdAt: result.createdAt
    });
  }

  async findByAgentId(agentId: string): Promise<Team[]> {
    // Use PostgreSQL array contains operator to find teams that include the agent
    const results = await this.db
      .select()
      .from(teams)
      .where(sql`${teams.agentIds} @> ARRAY[${agentId}]::text[]`);

    return results.map(result => Team.fromPersistence({
      id: result.id,
      name: result.name,
      purpose: result.purpose,
      description: result.description,
      responsibilities: result.responsibilities,
      goals: result.goals,
      agentIds: result.agentIds,
      databaseId: result.databaseId,
      organizationId: result.organizationId,
      createdAt: result.createdAt
    }));
  }

  async save(team: Team): Promise<void> {
    if (team.id === 0) {
      // Insert new team
      await this.db.insert(teams).values({
        name: team.name,
        purpose: team.purpose,
        description: team.description,
        responsibilities: team.responsibilities,
        goals: team.goals,
        agentIds: team.agentIds,
        databaseId: team.databaseId,
        organizationId: team.organizationId
      });
    } else {
      // Update existing team
      await this.db
        .update(teams)
        .set({
          name: team.name,
          purpose: team.purpose,
          description: team.description,
          responsibilities: team.responsibilities,
          goals: team.goals,
          agentIds: team.agentIds,
          databaseId: team.databaseId,
          organizationId: team.organizationId
        })
        .where(eq(teams.id, team.id));
    }
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(teams).where(eq(teams.id, id));
  }

  async countByOrganization(organizationId: number): Promise<number> {
    const result = await this.db
      .select({ count: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, organizationId));

    return result.length;
  }
}