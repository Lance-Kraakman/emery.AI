// AIDEV-NOTE: Team Task Permissions Application Service
// Manages task assignment and routing permissions for teams

import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import { TeamId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface TeamTaskPermissions {
  assignment?: {
    allowedUsers?: string[];            // User UUIDs
    allowedAgents?: number[];           // Agent IDs  
    allowedTeams?: number[];            // Team IDs
    allowTeamMembers?: boolean;         // Team members can assign
    allowOrgMembers?: boolean;          // Any org member can assign
    allowOrgAdmins?: boolean;           // Org admins can assign
  };
  routing?: {
    allowedAgents?: number[];           // Specific agent IDs
    allowedTeams?: number[];            // Specific team IDs
    allowAnyOrgAgent?: boolean;         // Any org agent
    allowCrossTeamRouting?: boolean;    // Other teams
    internalRoutingStrategy?: 'round_robin' | 'least_busy' | 'manual';
  };
}

export interface UpdateTeamPermissionsRequest {
  teamId: number;
  permissions: TeamTaskPermissions;
  updatedBy: string;                    // User ID updating permissions
  organizationId: number;
}

export interface GetTeamPermissionsRequest {
  teamId: number;
  organizationId: number;
}

export class TeamPermissionsApplicationService {
  constructor(
    private teamRepository: ITeamRepository
  ) {}

  async updateTeamTaskPermissions(request: UpdateTeamPermissionsRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { teamId, permissions, updatedBy, organizationId } = request;

      // Get the team to verify it exists and belongs to the organization
      const team = await this.teamRepository.findById(TeamId.fromNumber(teamId));
      
      if (!team) {
        return {
          success: false,
          error: "Team not found"
        };
      }

      if (team.organizationId.value !== organizationId) {
        return {
          success: false,
          error: "Team does not belong to the specified organization"
        };
      }

      // Validate permissions structure
      const validationError = this.validatePermissions(permissions);
      if (validationError) {
        return {
          success: false,
          error: validationError
        };
      }

      // Update team permissions
      await this.teamRepository.updateTaskPermissions(
        TeamId.fromNumber(teamId), 
        permissions
      );

      return { success: true };

    } catch (error) {
      console.error('Error updating team task permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update team permissions'
      };
    }
  }

  async getTeamTaskPermissions(request: GetTeamPermissionsRequest): Promise<{
    success: boolean;
    permissions?: TeamTaskPermissions;
    error?: string;
  }> {
    try {
      const { teamId, organizationId } = request;

      const team = await this.teamRepository.findById(TeamId.fromNumber(teamId));
      
      if (!team) {
        return {
          success: false,
          error: "Team not found"
        };
      }

      if (team.organizationId.value !== organizationId) {
        return {
          success: false,
          error: "Team does not belong to the specified organization"
        };
      }

      const permissions = await this.teamRepository.getTaskPermissions(
        TeamId.fromNumber(teamId)
      );

      return {
        success: true,
        permissions: permissions || {
          assignment: { allowOrgAdmins: true },
          routing: { allowCrossTeamRouting: false }
        }
      };

    } catch (error) {
      console.error('Error getting team task permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get team permissions'
      };
    }
  }

  async getAllTeamPermissionsForOrganization(organizationId: number): Promise<{
    success: boolean;
    teamPermissions?: Array<{
      teamId: number;
      teamName: string;
      permissions: TeamTaskPermissions;
    }>;
    error?: string;
  }> {
    try {
      const teams = await this.teamRepository.findByOrganization(
        OrganizationId.fromNumber(organizationId)
      );

      const teamPermissions = await Promise.all(
        teams.map(async (team) => {
          const permissions = await this.teamRepository.getTaskPermissions(team.id);
          return {
            teamId: team.id.value,
            teamName: team.name,
            permissions: permissions || {
              assignment: { allowOrgAdmins: true },
              routing: { allowCrossTeamRouting: false }
            }
          };
        })
      );

      return {
        success: true,
        teamPermissions
      };

    } catch (error) {
      console.error('Error getting organization team permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get team permissions'
      };
    }
  }

  private validatePermissions(permissions: TeamTaskPermissions): string | null {
    // Validate assignment permissions
    if (permissions.assignment) {
      const { allowedUsers, allowedAgents, allowedTeams } = permissions.assignment;

      if (allowedUsers && !Array.isArray(allowedUsers)) {
        return "allowedUsers must be an array of user IDs";
      }

      if (allowedAgents && !Array.isArray(allowedAgents)) {
        return "allowedAgents must be an array of agent IDs";
      }

      if (allowedTeams && !Array.isArray(allowedTeams)) {
        return "allowedTeams must be an array of team IDs";
      }

      // Validate user IDs are UUIDs (strings)
      if (allowedUsers?.some(id => typeof id !== 'string')) {
        return "All user IDs must be strings (UUIDs)";
      }

      // Validate agent IDs are numbers
      if (allowedAgents?.some(id => typeof id !== 'number' || !Number.isInteger(id))) {
        return "All agent IDs must be integers";
      }

      // Validate team IDs are numbers
      if (allowedTeams?.some(id => typeof id !== 'number' || !Number.isInteger(id))) {
        return "All team IDs must be integers";
      }
    }

    // Validate routing permissions
    if (permissions.routing) {
      const { allowedAgents, allowedTeams, internalRoutingStrategy } = permissions.routing;

      if (allowedAgents && !Array.isArray(allowedAgents)) {
        return "routing.allowedAgents must be an array of agent IDs";
      }

      if (allowedTeams && !Array.isArray(allowedTeams)) {
        return "routing.allowedTeams must be an array of team IDs";
      }

      // Validate agent IDs are numbers
      if (allowedAgents?.some(id => typeof id !== 'number' || !Number.isInteger(id))) {
        return "All routing agent IDs must be integers";
      }

      // Validate team IDs are numbers
      if (allowedTeams?.some(id => typeof id !== 'number' || !Number.isInteger(id))) {
        return "All routing team IDs must be integers";
      }

      // Validate internal routing strategy
      if (internalRoutingStrategy && 
          !['round_robin', 'least_busy', 'manual'].includes(internalRoutingStrategy)) {
        return "internalRoutingStrategy must be one of: round_robin, least_busy, manual";
      }
    }

    return null;
  }
}