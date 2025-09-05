// AIDEV-NOTE: Drizzle implementation of Team repository
// Handles data persistence for Team domain entities

import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import { Team } from '@/ddd/domain/teams/entities/team';
import type { TeamTaskPermissions } from '@/ddd/application/services/teams/team-permissions-application-service';
import { OrganizationId, TeamId, AgentId } from '@/ddd/domain/shared/value-objects';
import { teams } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';

export class DrizzleTeamRepository implements ITeamRepository {
  constructor(private readonly db: DbClient) {}

  async findByOrganization(organizationId: OrganizationId): Promise<Team[]> {
    const results = await this.db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId.value));

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

  async findById(id: TeamId): Promise<Team | null> {
    const results = await this.db
      .select()
      .from(teams)
      .where(eq(teams.id, id.value))
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

  async findByAgentId(agentId: AgentId): Promise<Team[]> {
    // Use PostgreSQL array contains operator to find teams that include the agent
    const results = await this.db
      .select()
      .from(teams)
      .where(sql`${teams.agentIds} @> ARRAY[${agentId.value}]::text[]`);

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

  async save(team: Team): Promise<Team> {
    if (team.id.value <= 0) {
      // Insert new team and return with generated ID
      const insertResult = await this.db.insert(teams).values({
        name: team.name,
        purpose: team.purpose,
        description: team.description,
        responsibilities: team.responsibilities,
        goals: team.goals,
        agentIds: team.agentIds?.map(id => id.value.toString()) || null,
        databaseId: team.databaseId,
        organizationId: team.organizationId.value
      }).returning({
        id: teams.id,
        name: teams.name,
        purpose: teams.purpose,
        description: teams.description,
        responsibilities: teams.responsibilities,
        goals: teams.goals,
        agentIds: teams.agentIds,
        databaseId: teams.databaseId,
        organizationId: teams.organizationId,
        createdAt: teams.createdAt
      });

      if (insertResult.length === 0) {
        throw new Error('Failed to insert team - no result returned');
      }

      const result = insertResult[0];
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
          agentIds: team.agentIds?.map(id => id.value.toString()) || null,
          databaseId: team.databaseId,
          organizationId: team.organizationId.value
        })
        .where(eq(teams.id, team.id.value));
      
      return team; // Return the existing team unchanged for updates
    }
  }

  async delete(id: TeamId): Promise<void> {
    await this.db.delete(teams).where(eq(teams.id, id.value));
  }

  async countByOrganization(organizationId: OrganizationId): Promise<number> {
    const result = await this.db
      .select({ count: teams.id })
      .from(teams)
      .where(eq(teams.organizationId, organizationId.value));

    return result.length;
  }

  async updateTaskPermissions(id: TeamId, permissions: TeamTaskPermissions): Promise<void> {
    await this.db
      .update(teams)
      .set({ taskPermissions: permissions })
      .where(eq(teams.id, id.value));
  }

  async getTaskPermissions(id: TeamId): Promise<TeamTaskPermissions | null> {
    const [result] = await this.db
      .select({ taskPermissions: teams.taskPermissions })
      .from(teams)
      .where(eq(teams.id, id.value))
      .limit(1);
    
    return result?.taskPermissions || null;
  }
}