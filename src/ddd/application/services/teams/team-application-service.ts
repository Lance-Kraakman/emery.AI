/**
 * Team Application Service
 *
 * Handles team business operations including CRUD, member management,
 * agent assignment, and organization scoping.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';

const logger = createDebugLogger('TeamService');
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { Result } from '@/ddd/domain/shared/result';
import { Team } from '@/ddd/domain/teams/entities/team';
import { TeamId, OrganizationId, AgentId } from '@/ddd/domain/shared/value-objects';
import type { CreateTeamDTO, UpdateTeamDTO, TeamFiltersDTO, TeamDTO } from '@/app/dtos/team.dto';

// Re-export DTOs for backward compatibility during migration
export type { CreateTeamDTO, UpdateTeamDTO, TeamFiltersDTO, TeamDTO };

export class TeamApplicationService {

  constructor(
    private readonly teamRepository: ITeamRepository,
    private readonly agentRepository: IAgentRepository
  ) {}

  /**
   * Create a new team with business validation
   */
  async createTeam(dto: CreateTeamDTO): Promise<Result<TeamDTO>> {
    try {
      // Business validation
      if (!dto.name?.trim()) {
        return {
          success: false,
          error: "Team name is required"
        };
      }

      // Validate agent IDs if provided
      const warnings: string[] = [];
      let validatedAgentIds = dto.agentIds;
      if (dto.agentIds && dto.agentIds.length > 0) {
        const agents = await this.agentRepository.findByOrganization(OrganizationId.fromNumber(dto.organizationId));
        const validAgentIds = agents.map(a => a.id.toString());
        const invalidAgentIds = dto.agentIds.filter(id => !validAgentIds.includes(id));

        if (invalidAgentIds.length > 0) {
          warnings.push(`Invalid agent IDs: ${invalidAgentIds.join(', ')}`);
          // Remove invalid agent IDs
          validatedAgentIds = dto.agentIds.filter(id => !invalidAgentIds.includes(id));
        }
      }

      // Create team using domain entity with temporary ID (repository will assign real ID)
      const team = Team.fromPersistence({
        id: -1, // Use -1 for temporary ID (allowed by BaseId validation)
        name: dto.name.trim(),
        purpose: dto.purpose,
        description: dto.description,
        responsibilities: dto.responsibilities,
        goals: dto.goals,
        agentIds: validatedAgentIds ? validatedAgentIds.map(id => id.toString()) : undefined,
        databaseId: dto.databaseId,
        organizationId: dto.organizationId,
        ownerId: dto.ownerId
      });

      // Create team via repository
      const createData = {
        name: dto.name,
        purpose: dto.purpose || null,
        description: dto.description || null,
        responsibilities: dto.responsibilities || null,
        goals: dto.goals || null,
        agentIds: validatedAgentIds ? validatedAgentIds.map(id => id.toString()) : null,
        databaseId: dto.databaseId || null,
        organizationId: dto.organizationId,
        ownerId: dto.ownerId
      };
      const savedTeam = await this.teamRepository.create(createData);

      return {
        success: true,
        data: this.toDTO(savedTeam),
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error("Error creating team:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create team"
      };
    }
  }

  /**
   * Update an existing team
   */
  async updateTeam(dto: UpdateTeamDTO): Promise<Result<TeamDTO>> {
    try {
      // Load existing team
      const existingTeam = await this.teamRepository.findById(TeamId.fromNumber(dto.id));
      if (!existingTeam) {
        return {
          success: false,
          error: `Team with ID ${dto.id} not found`
        };
      }

      // Validate agent IDs if provided
      const warnings: string[] = [];
      let validatedAgentIds = dto.agentIds;
      if (dto.agentIds && dto.agentIds.length > 0) {
        const agents = await this.agentRepository.findByOrganization(existingTeam.organizationId);
        const validAgentIds = agents.map(a => a.id.toString());
        const invalidAgentIds = dto.agentIds.filter(id => !validAgentIds.includes(id));
        
        if (invalidAgentIds.length > 0) {
          warnings.push(`Invalid agent IDs: ${invalidAgentIds.join(', ')}`);
          // Remove invalid agent IDs
          validatedAgentIds = dto.agentIds.filter(id => !invalidAgentIds.includes(id));
        }
      }

      // Create updated team with existing values as defaults
      const updatedTeam = Team.fromPersistence({
        id: existingTeam.id.value,
        name: dto.name !== undefined ? dto.name : existingTeam.name,
        purpose: dto.purpose !== undefined ? dto.purpose : existingTeam.purpose,
        description: dto.description !== undefined ? dto.description : existingTeam.description,
        responsibilities: dto.responsibilities !== undefined ? dto.responsibilities : existingTeam.responsibilities,
        goals: dto.goals !== undefined ? dto.goals : existingTeam.goals,
        agentIds: validatedAgentIds !== undefined ? validatedAgentIds : existingTeam.agentIds?.map(id => id.toString()) || null,
        organizationId: existingTeam.organizationId.value,
        ownerId: existingTeam.ownerId.value,
        createdAt: existingTeam.createdAt
      });

      // Update team via repository
      const updateData = {
        name: dto.name,
        purpose: dto.purpose,
        description: dto.description,
        responsibilities: dto.responsibilities,
        goals: dto.goals
      };
      const savedTeam = await this.teamRepository.update(TeamId.fromNumber(dto.id), updateData);

      return {
        success: true,
        data: this.toDTO(savedTeam),
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error("Error updating team:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update team"
      };
    }
  }

  /**
   * Delete a team
   */
  async deleteTeam(teamId: number): Promise<Result<void>> {
    try {
      const team = await this.teamRepository.findById(TeamId.fromNumber(teamId));
      if (!team) {
        return {
          success: false,
          error: `Team with ID ${teamId} not found`
        };
      }

      await this.teamRepository.delete(TeamId.fromNumber(teamId));

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error deleting team:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete team"
      };
    }
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: number): Promise<Team | null> {
    return await this.teamRepository.findById(TeamId.fromNumber(teamId));
  }

  /**
   * Get teams with filtering and organization scoping
   */
  async getTeams(filters: TeamFiltersDTO): Promise<Team[]> {
    try {
      let teams = await this.teamRepository.findByOrganization(OrganizationId.fromNumber(filters.organizationId));

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        teams = teams.filter(team => 
          team.name.toLowerCase().includes(searchLower) ||
          team.description?.toLowerCase().includes(searchLower) ||
          team.purpose?.toLowerCase().includes(searchLower)
        );
      }

      // Apply agent filter
      if (filters.hasAgents !== undefined) {
        if (filters.hasAgents) {
          teams = teams.filter(team => team.agentCount > 0);
        } else {
          teams = teams.filter(team => team.agentCount === 0);
        }
      }

      // Sort by creation date (newest first)
      teams.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      return teams;
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw new Error("Failed to fetch teams");
    }
  }

  /**
   * Convert Team domain entity to TeamDTO
   */
  private toDTO(team: Team): TeamDTO {
    return {
      id: team.id.value,
      name: team.name,
      purpose: team.purpose || undefined,
      description: team.description || undefined,
      responsibilities: team.responsibilities || undefined,
      goals: team.goals || undefined,
      agentIds: team.agentIds?.map(id => id.value.toString()) || undefined,
      databaseId: team.databaseId || undefined,
      organizationId: team.organizationId.value,
      createdAt: team.createdAt || undefined,
      updatedAt: undefined // Team entity doesn't track updatedAt
    };
  }

  /**
   * Add agent to team
   */
  async addAgentToTeam(teamId: number, agentId: string): Promise<Result<TeamDTO>> {
    try {
      const existingTeam = await this.teamRepository.findById(TeamId.fromNumber(teamId));
      if (!existingTeam) {
        return {
          success: false,
          error: `Team with ID ${teamId} not found`
        };
      }

      // Validate agent exists in organization
      const agents = await this.agentRepository.findByOrganization(existingTeam.organizationId);
      const agentExists = agents.some(a => a.id.toString() === agentId);
      
      if (!agentExists) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found in organization`
        };
      }

      // Check if agent is already in team
      const currentAgentIds = existingTeam.agentIds || [];
      if (currentAgentIds.some(id => id.value.toString() === agentId)) {
        return {
          success: false,
          error: `Agent ${agentId} is already in the team`
        };
      }

      // Add agent to team
      const updatedAgentIds = [...(currentAgentIds?.map(id => id.toString()) || []), agentId];
      const updatedTeam = Team.fromPersistence({
        id: existingTeam.id.value,
        name: existingTeam.name,
        purpose: existingTeam.purpose,
        description: existingTeam.description,
        responsibilities: existingTeam.responsibilities,
        goals: existingTeam.goals,
        agentIds: updatedAgentIds,
        organizationId: existingTeam.organizationId.value,
        ownerId: existingTeam.ownerId.value,
        createdAt: existingTeam.createdAt
      });

      const savedTeam = await this.teamRepository.update(TeamId.fromNumber(teamId), { agentIds: updatedAgentIds });

      return {
        success: true,
        data: this.toDTO(savedTeam)
      };
    } catch (error) {
      console.error("Error adding agent to team:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add agent to team"
      };
    }
  }

  /**
   * Remove agent from team
   */
  async removeAgentFromTeam(teamId: number, agentId: string): Promise<Result<TeamDTO>> {
    try {
      const existingTeam = await this.teamRepository.findById(TeamId.fromNumber(teamId));
      if (!existingTeam) {
        return {
          success: false,
          error: `Team with ID ${teamId} not found`
        };
      }

      // Check if agent is in team
      const currentAgentIds = existingTeam.agentIds || [];
      if (!currentAgentIds.some(id => id.value.toString() === agentId)) {
        return {
          success: false,
          error: `Agent ${agentId} is not in the team`
        };
      }

      // Remove agent from team
      const updatedAgentIds = (currentAgentIds?.map(id => id.toString()) || []).filter(id => id !== agentId);
      const updatedTeam = Team.fromPersistence({
        id: existingTeam.id.value,
        name: existingTeam.name,
        purpose: existingTeam.purpose,
        description: existingTeam.description,
        responsibilities: existingTeam.responsibilities,
        goals: existingTeam.goals,
        agentIds: updatedAgentIds,
        organizationId: existingTeam.organizationId.value,
        ownerId: existingTeam.ownerId.value,
        createdAt: existingTeam.createdAt
      });

      const savedTeam = await this.teamRepository.update(TeamId.fromNumber(teamId), { agentIds: updatedAgentIds });

      return {
        success: true,
        data: this.toDTO(savedTeam)
      };
    } catch (error) {
      console.error("Error removing agent from team:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove agent from team"
      };
    }
  }

  /**
   * Get teams that contain a specific agent
   */
  async getTeamsForAgent(agentId: AgentId): Promise<Team[]> {
    return await this.teamRepository.findByAgentId(agentId);
  }

  /**
   * Get team count for organization
   */
  async getTeamCount(organizationId: OrganizationId): Promise<number> {
    return await this.teamRepository.countByOrganization(organizationId);
  }

  /**
   * Bulk assign agents to team
   */
  async bulkAssignAgents(teamId: TeamId, agentIds: AgentId[]): Promise<Result<TeamDTO>> {
    try {
      const existingTeam = await this.teamRepository.findById(teamId);
      if (!existingTeam) {
        return {
          success: false,
          error: `Team with ID ${teamId} not found`
        };
      }

      // Validate all agent IDs
      const agents = await this.agentRepository.findByOrganization(existingTeam.organizationId);
      const validAgentIds = agents.map(a => a.id.toString());
      const invalidAgentIds = agentIds.filter(id => !validAgentIds.includes(id.toString()));
      
      if (invalidAgentIds.length > 0) {
        return {
          success: false,
          error: `Invalid agent IDs: ${invalidAgentIds.join(', ')}`
        };
      }

      // Replace agent assignments
      const updatedTeam = Team.fromPersistence({
        id: existingTeam.id.value,
        name: existingTeam.name,
        purpose: existingTeam.purpose,
        description: existingTeam.description,
        responsibilities: existingTeam.responsibilities,
        goals: existingTeam.goals,
        agentIds: agentIds.map(id => id.value.toString()),
        organizationId: existingTeam.organizationId.value,
        ownerId: existingTeam.ownerId.value,
        createdAt: existingTeam.createdAt
      });

      const savedTeam = await this.teamRepository.update(teamId, { agentIds: agentIds.map(id => id.toString()) });

      return {
        success: true,
        data: this.toDTO(savedTeam)
      };
    } catch (error) {
      console.error("Error bulk assigning agents:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to assign agents to team"
      };
    }
  }
}
