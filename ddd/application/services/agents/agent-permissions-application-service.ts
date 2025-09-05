// AIDEV-NOTE: Agent Task Permissions Application Service
// Manages task assignment and routing permissions for agents

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

export interface AgentTaskPermissions {
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
    allowAnyTeamAgent?: boolean;        // Same team agents
    allowAnyOrgAgent?: boolean;         // Any org agent
    allowCrossTeamRouting?: boolean;    // Cross-team routing
  };
}

export interface UpdateAgentPermissionsRequest {
  agentId: number;
  permissions: AgentTaskPermissions;
  updatedBy: string;                    // User ID updating permissions
  organizationId: number;
}

export interface GetAgentPermissionsRequest {
  agentId: number;
  organizationId: number;
}

export class AgentPermissionsApplicationService {
  constructor(
    private agentRepository: IAgentRepository
  ) {}

  async updateAgentTaskPermissions(request: UpdateAgentPermissionsRequest): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const { agentId, permissions, updatedBy, organizationId } = request;

      // Get the agent to verify it exists and belongs to the organization
      const agent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      
      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      if (agent.organizationId.value !== organizationId) {
        return {
          success: false,
          error: "Agent does not belong to the specified organization"
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

      // Update agent permissions
      await this.agentRepository.updateTaskPermissions(
        AgentId.fromNumber(agentId), 
        permissions
      );

      return { success: true };

    } catch (error) {
      console.error('Error updating agent task permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update agent permissions'
      };
    }
  }

  async getAgentTaskPermissions(request: GetAgentPermissionsRequest): Promise<{
    success: boolean;
    permissions?: AgentTaskPermissions;
    error?: string;
  }> {
    try {
      const { agentId, organizationId } = request;

      const agent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      
      if (!agent) {
        return {
          success: false,
          error: "Agent not found"
        };
      }

      if (agent.organizationId.value !== organizationId) {
        return {
          success: false,
          error: "Agent does not belong to the specified organization"
        };
      }

      const permissions = await this.agentRepository.getTaskPermissions(
        AgentId.fromNumber(agentId)
      );

      return {
        success: true,
        permissions: permissions || {
          assignment: { allowOrgAdmins: true },
          routing: { allowAnyTeamAgent: true }
        }
      };

    } catch (error) {
      console.error('Error getting agent task permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent permissions'
      };
    }
  }

  async getAllAgentPermissionsForOrganization(organizationId: number): Promise<{
    success: boolean;
    agentPermissions?: Array<{
      agentId: number;
      agentName: string;
      permissions: AgentTaskPermissions;
    }>;
    error?: string;
  }> {
    try {
      const agents = await this.agentRepository.findByOrganization(
        OrganizationId.fromNumber(organizationId)
      );

      const agentPermissions = await Promise.all(
        agents.map(async (agent) => {
          const permissions = await this.agentRepository.getTaskPermissions(agent.id);
          return {
            agentId: agent.id.value,
            agentName: agent.name,
            permissions: permissions || {
              assignment: { allowOrgAdmins: true },
              routing: { allowAnyTeamAgent: true }
            }
          };
        })
      );

      return {
        success: true,
        agentPermissions
      };

    } catch (error) {
      console.error('Error getting organization agent permissions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agent permissions'
      };
    }
  }

  private validatePermissions(permissions: AgentTaskPermissions): string | null {
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
      const { allowedAgents, allowedTeams } = permissions.routing;

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
    }

    return null;
  }
}