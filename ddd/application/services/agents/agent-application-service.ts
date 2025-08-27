/**
 * Agent Application Service
 * 
 * Handles agent business operations including CRUD, API key management,
 * capability management, and organization scoping.
 */

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { IRoleRepository } from '@/ddd/domain/roles/repositories/role-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { 
  Agent, 
  CreateAgentData, 
  UpdateAgentData,
  ToolConfig,
  ServerConfig,
  CapabilityConfig,
  AgentType
} from '@/ddd/domain/agents/entities/agent';
import type { Result } from '@/ddd/domain/shared/result';
import { createAgentDefaults } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, UserId, TeamId, AgentStatus, ApiKey, AGENT_STATUS } from '@/ddd/domain/shared/value-objects';
import { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';

export interface CreateAgentCommand {
  name: string;
  role?: string;
  description?: string;
  persona?: string;
  ownerId: UserId;
  organizationId: OrganizationId;
  roleId: number;
  agentType?: AgentType;
  specialization?: any;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  trigger?: TriggerConfig;
  capabilities?: CapabilityConfig[];
  status?: 'active' | 'inactive' | 'archived';
}

export interface UpdateAgentCommand {
  agentId: AgentId;
  name?: string;
  role?: string;
  description?: string;
  persona?: string;
  roleId?: number;
  tools?: ToolConfig[];
  servers?: ServerConfig[];
  trigger?: TriggerConfig;
  capabilities?: CapabilityConfig[];
  status?: 'active' | 'inactive' | 'archived';
}

export interface AgentFilters {
  teamId?: TeamId | number | string;
  searchQuery?: string;
  organizationId: OrganizationId;
  status?: 'active' | 'inactive' | 'archived';
  agentTypes?: AgentType[];
}

export interface AgentCapability {
  name: string;
  description: string;
  tools: string[];
  servers: any[];
}

// Use unified Result interface from domain shared types
export type AgentApplicationResult<T = any> = Result<T>;

export class AgentApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly roleRepository: IRoleRepository,
    private readonly teamRepository: ITeamRepository
  ) {}

  /**
   * Create a new agent with business validation
   */
  async createAgent(command: CreateAgentCommand): Promise<AgentApplicationResult<Agent>> {
    try {
      // Business validation
      if (!command.name?.trim()) {
        return {
          success: false,
          error: "Agent name is required"
        };
      }

      // Validate role exists if provided
      if (command.roleId) {
        const role = await this.roleRepository.findById(command.roleId);
        if (!role) {
          return {
            success: false,
            error: `Role with ID ${command.roleId} not found`
          };
        }
      }

      // Generate API key for agent authentication
      const apiKey = ApiKey.generate();

      // Create agent data with defaults - ensure required fields are set
      const agentData: CreateAgentData = {
        name: command.name.trim(),
        role: command.role,
        description: command.description,
        persona: command.persona,
        ownerId: command.ownerId, // Required from command
        organizationId: command.organizationId, // Required from command
        roleId: command.roleId,
        agentType: command.agentType,
        specialization: command.specialization,
        tools: command.tools,
        servers: command.servers,
        trigger: command.trigger,
        capabilities: command.capabilities,
        status: command.status ? AgentStatus.fromString(command.status) : undefined
      };

      // Apply defaults and add generated fields
      const agentWithDefaults = createAgentDefaults(agentData);
      const agent: Agent = {
        id: AgentId.placeholder(), // Will be set by repository after insert
        ...agentWithDefaults,
        organizationId: command.organizationId, // Ensure these required fields are set
        ownerId: command.ownerId,
        apiKey: apiKey,
        createdAt: null,
        updatedAt: null
      };

      // Save to repository and get the saved agent with ID
      const savedAgent = await this.agentRepository.save(agent);

      return {
        success: true,
        data: savedAgent
      };
    } catch (error) {
      console.error("Error creating agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create agent"
      };
    }
  }

  /**
   * Update an existing agent
   */
  async updateAgent(command: UpdateAgentCommand): Promise<AgentApplicationResult<Agent>> {
    try {
      // Load existing agent
      const existingAgent = await this.agentRepository.findById(command.agentId);
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${command.agentId} not found`
        };
      }

      // Validate role exists if provided
      if (command.roleId) {
        const role = await this.roleRepository.findById(command.roleId);
        if (!role) {
          return {
            success: false,
            error: `Role with ID ${command.roleId} not found`
          };
        }
      }

      // Create updated agent with existing values as defaults
      const updatedAgent: Agent = {
        id: existingAgent.id,
        name: command.name !== undefined ? command.name : existingAgent.name,
        role: command.role !== undefined ? command.role : existingAgent.role,
        description: command.description !== undefined ? command.description : existingAgent.description,
        persona: command.persona !== undefined ? command.persona : existingAgent.persona,
        roleId: command.roleId !== undefined ? command.roleId : existingAgent.roleId,
        tools: command.tools !== undefined ? command.tools : existingAgent.tools,
        servers: command.servers !== undefined ? command.servers : existingAgent.servers,
        trigger: command.trigger !== undefined ? command.trigger : existingAgent.trigger,
        capabilities: command.capabilities !== undefined ? command.capabilities : existingAgent.capabilities,
        status: command.status !== undefined ? AgentStatus.fromString(command.status) : existingAgent.status,
        organizationId: existingAgent.organizationId,
        ownerId: existingAgent.ownerId,
        databaseId: existingAgent.databaseId,
        apiKey: existingAgent.apiKey,
        createdAt: existingAgent.createdAt,
        updatedAt: new Date()
      };

      // Save updated agent
      const savedAgent = await this.agentRepository.save(updatedAgent);

      return {
        success: true,
        data: savedAgent
      };
    } catch (error) {
      console.error("Error updating agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update agent"
      };
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: AgentId): Promise<AgentApplicationResult<void>> {
    try {
      const agent = await this.agentRepository.findById(agentId);
      if (!agent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      await this.agentRepository.delete(agentId);

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error deleting agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete agent"
      };
    }
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: AgentId): Promise<Agent | null> {
    return await this.agentRepository.findById(agentId);
  }

  /**
   * Get agents with filtering and organization scoping
   */
  async getAgents(filters: AgentFilters): Promise<Agent[]> {
    try {
      let agents: Agent[];

      // Get all agents for organization first
      agents = await this.agentRepository.findByOrganization(filters.organizationId);

      // If filtering by team, filter the results
      if (filters.teamId && filters.teamId !== 'all') {
        const teamIdNumber = Number(filters.teamId);
        if (isNaN(teamIdNumber)) {
          console.warn(`Invalid teamId provided: ${filters.teamId}`);
          return [];
        }

        const team = await this.teamRepository.findById(TeamId.fromNumber(teamIdNumber));
        if (!team || !team.agentIds || team.agentIds.length === 0) {
          return [];
        }

        // Filter agents to only those in the team
        agents = agents.filter(agent => team.agentIds?.some(teamAgentId => teamAgentId.value === agent.id.value) || false);
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        agents = agents.filter(agent => 
          agent.name.toLowerCase().includes(searchLower) ||
          agent.description?.toLowerCase().includes(searchLower)
        );
      }

      // Apply agent type filter
      if (filters.agentTypes && filters.agentTypes.length > 0) {
        agents = agents.filter(agent => 
          agent.agentType && filters.agentTypes!.includes(agent.agentType)
        );
      }

      // Apply status filter
      if (filters.status) {
        agents = agents.filter(agent => agent.status.value === filters.status);
      }

      // Sort by creation date (newest first)
      agents.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      return agents;
    } catch (error) {
      console.error("Error fetching agents:", error);
      throw new Error("Failed to fetch agents");
    }
  }

  /**
   * Add capability to agent
   */
  async addCapabilityToAgent(agentId: AgentId, capability: CapabilityConfig): Promise<AgentApplicationResult<Agent>> {
    try {
      const existingAgent = await this.agentRepository.findById(agentId);
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      // Get existing capabilities and add new one
      const existingCapabilities = existingAgent.capabilities || [];
      const updatedCapabilities = [...existingCapabilities, capability];

      // Create updated agent with new capability
      const updatedAgent: Agent = {
        ...existingAgent,
        capabilities: updatedCapabilities,
        updatedAt: new Date()
      };

      const savedAgent = await this.agentRepository.save(updatedAgent);

      return {
        success: true,
        data: savedAgent
      };
    } catch (error) {
      console.error("Error adding capability to agent:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add capability"
      };
    }
  }

  /**
   * Regenerate API key for agent
   */
  async regenerateApiKey(agentId: number): Promise<AgentApplicationResult<{ apiKey: string }>> {
    try {
      const existingAgent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      // Generate new API key
      const newApiKey = ApiKey.generate();
      
      // Create updated agent with new API key
      const updatedAgent: Agent = {
        ...existingAgent,
        apiKey: newApiKey,
        updatedAt: new Date()
      };
      
      const savedAgent = await this.agentRepository.save(updatedAgent);

      return {
        success: true,
        data: { apiKey: newApiKey.value }
      };
    } catch (error) {
      console.error("Error regenerating API key:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to regenerate API key"
      };
    }
  }

  /**
   * Get agents by owner
   */
  async getAgentsByOwner(ownerId: string): Promise<Agent[]> {
    return await this.agentRepository.findByOwner(UserId.fromString(ownerId));
  }

  /**
   * Activate/deactivate agent
   */
  async toggleAgentStatus(agentId: number): Promise<AgentApplicationResult<Agent>> {
    try {
      const existingAgent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      const newStatus = existingAgent.status.value === 'active' ? AgentStatus.inactive() : AgentStatus.active();
      
      // Create updated agent with new status
      const updatedAgent: Agent = {
        ...existingAgent,
        status: newStatus,
        updatedAt: new Date()
      };
      
      const savedAgent = await this.agentRepository.save(updatedAgent);

      return {
        success: true,
        data: savedAgent
      };
    } catch (error) {
      console.error("Error toggling agent status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle agent status"
      };
    }
  }

}