/**
 * Agent Application Service
 *
 * Handles agent business operations including CRUD, API key management,
 * capability management, and organization scoping.
 *
 * AIDEV-NOTE: Now accepts DTOs directly instead of Commands for simplified architecture
 */

import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { CredentialDelegationApplicationService } from '@/ddd/application/services/delegations/credential-delegation-application-service';
import type { ConnectionApplicationService } from '@/ddd/application/services/connections/connection-application-service';
import {
  Agent,
  type CreateAgentData,
  type UpdateAgentData
} from '@/ddd/domain/agents/entities/agent';
import type { Result } from '@/ddd/domain/shared/result';
import { createAgentDefaults } from '@/ddd/domain/agents/entities/agent';
import { AgentId, OrganizationId, UserId, TeamId, AgentStatus, ApiKey, AGENT_STATUS } from '@/ddd/domain/shared/value-objects';
import { AppName } from '@/ddd/domain/connections/value-objects';
import { TriggerConfig, TriggerConfigFromJSON } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { CreateAgentDTO, UpdateAgentDTO, AgentFiltersDTO, AgentDTO } from '@/app/dtos/agent.dto';
import type { AutomationConfiguration } from '@/ddd/domain/agents/entities/agent';
import { AgentMapper } from '@/app/mappers/agent-mapper';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('AgentService');

// Re-export DTOs for backward compatibility during migration
export type { CreateAgentDTO, UpdateAgentDTO, AgentFiltersDTO, AgentDTO };

export class AgentApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly teamRepository: ITeamRepository,
    private readonly delegationService?: CredentialDelegationApplicationService,
    private readonly connectionService?: ConnectionApplicationService
  ) {}

  /**
   * Create a new agent with business validation
   * AIDEV-NOTE: Now accepts DTO and returns DTO for consistent serialization
   */
  async createAgent(dto: CreateAgentDTO): Promise<Result<AgentDTO & { apiKeyPlaintext?: string }>> {
    try {
      // Business validation
      if (!dto.name?.trim()) {
        return {
          success: false,
          error: "Agent name is required"
        };
      }

      // Convert DTO primitives to Value Objects
      const ownerId = dto.ownerId ? UserId.fromString(dto.ownerId) : undefined;
      const organizationId = dto.organizationId ? OrganizationId.fromNumber(dto.organizationId) : undefined;

      if (!ownerId || !organizationId) {
        return {
          success: false,
          error: "Owner ID and Organization ID are required"
        };
      }

      // Create agent data with defaults
      const agentData: CreateAgentData = {
        name: dto.name.trim(),
        role: dto.role,
        description: dto.description,
        persona: dto.persona,
        ownerId,
        organizationId,
        // Convert AutomationConfigurationDTO[] to AutomationConfiguration[]
        automations: dto.automations ? this.automationsFromDTOs(dto.automations) : [],
        status: dto.status ? AgentStatus.fromString(dto.status) : undefined,
        allowNetwork: dto.allowNetwork // Default true is applied in createAgentDefaults
      };

      // Apply defaults and add generated fields
      const agentWithDefaults = createAgentDefaults(agentData);

      // Create agent via repository
      const createData: CreateAgentData = {
        name: agentWithDefaults.name,
        role: agentWithDefaults.role,
        description: agentWithDefaults.description,
        persona: agentWithDefaults.persona,
        automations: agentWithDefaults.automations,
        organizationId: organizationId,
        ownerId: ownerId,
        status: agentWithDefaults.status,
        databaseId: agentWithDefaults.databaseId
      };

      const savedAgent = await this.agentRepository.create(createData);

      // Generate API key (hash stored, plaintext returned once)
      const { plaintext: apiKeyPlaintext, hash: apiKeyHash, prefix: apiKeyPrefix } = ApiKey.generateWithHash();
      await this.agentRepository.update(savedAgent.id, {
        apiKeyHash,
        apiKeyPrefix,
      });

      // SECURITY: Delegations must be explicitly created by the owner
      // No auto-delegation on agent creation - owner must configure which services to delegate
      logger.debug('Agent created - owner must explicitly configure OAuth delegations', {
        agentId: savedAgent.id.value,
        ownerId: savedAgent.ownerId.value
      });

      // Convert domain entity to DTO for serialization
      const agentDTO = AgentMapper.toDTO(savedAgent);

      return {
        success: true,
        data: { ...agentDTO, apiKeyPlaintext }
      };
    } catch (error) {
      logger.error("Error creating agent", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create agent"
      };
    }
  }

  /**
   * Update an existing agent
   * AIDEV-NOTE: Now accepts DTO and returns DTO for consistent serialization
   */
  async updateAgent(dto: UpdateAgentDTO): Promise<Result<AgentDTO>> {
    try {
      // LOGGING: Start of update operation
      logger.debug('Updating agent', {
        agentId: dto.id,
        hasAutomations: !!dto.automations,
        automationCount: dto.automations?.length,
        updateFields: Object.keys(dto).filter(k => dto[k as keyof UpdateAgentDTO] !== undefined)
      });

      // Convert ID to Value Object
      const agentId = AgentId.fromNumber(dto.id);

      // Load existing agent
      const existingAgent = await this.agentRepository.findById(agentId);
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${dto.id} not found`
        };
      }

      // Build update data with only changed fields
      const updateData: any = {};

      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.role !== undefined) updateData.role = dto.role;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.persona !== undefined) updateData.persona = dto.persona;
      if (dto.ownerId !== undefined) updateData.ownerId = UserId.fromString(dto.ownerId);
      // Convert AutomationConfigurationDTO[] to AutomationConfiguration[]
      if (dto.automations !== undefined) updateData.automations = this.automationsFromDTOs(dto.automations);
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.avatarConfig !== undefined) updateData.avatarConfig = dto.avatarConfig;
      if (dto.defaultModel !== undefined) updateData.defaultModel = dto.defaultModel;
      if (dto.allowNetwork !== undefined) updateData.allowNetwork = dto.allowNetwork;

      // LOGGING: Update data prepared
      logger.debug('Update data prepared for repository', {
        agentId: dto.id,
        updateDataKeys: Object.keys(updateData),
        hasAutomations: !!updateData.automations,
        automationCount: updateData.automations?.length,
        automations: updateData.automations
      });

      // Update agent via repository
      const savedAgent = await this.agentRepository.update(agentId, updateData);

      // LOGGING: Agent updated successfully
      logger.debug('Agent updated successfully', {
        agentId: savedAgent.id.value,
        automationCount: savedAgent.automations?.length
      });

      // Convert domain entity to DTO for serialization
      const agentDTO = AgentMapper.toDTO(savedAgent);

      logger.summary('Agent update completed', {
        agentId: dto.id,
        success: true
      });

      return {
        success: true,
        data: agentDTO
      };
    } catch (error) {
      logger.error("Error updating agent", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update agent"
      };
    }
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: AgentId): Promise<Result<void>> {
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
      logger.error("Error deleting agent", error);
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
   * AIDEV-NOTE: Now accepts and returns DTOs for consistent serialization
   */
  async getAgents(filters: AgentFiltersDTO): Promise<AgentDTO[]> {
    try {
      let agents: Agent[];

      // Convert filter DTO to Value Object
      const organizationId = OrganizationId.fromNumber(filters.organizationId);

      // Get all agents for organization first
      agents = await this.agentRepository.findByOrganization(organizationId);

      // If filtering by team, filter the results
      if (filters.teamId && filters.teamId !== 'all') {
        const teamIdNumber = Number(filters.teamId);
        if (isNaN(teamIdNumber)) {
          logger.debug('Invalid teamId provided', { teamId: filters.teamId });
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

      // Convert domain entities to DTOs for serialization
      return agents.map(agent => AgentMapper.toDTO(agent));
    } catch (error) {
      logger.error("Error fetching agents", error);
      throw new Error("Failed to fetch agents");
    }
  }

  /**
   * Regenerate API key for agent
   */
  async regenerateApiKey(agentId: number): Promise<Result<{ apiKey: string, prefix: string }>> {
    try {
      const existingAgent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      // Generate new API key (256-bit entropy)
      const { plaintext, hash, prefix } = ApiKey.generateWithHash();

      // Move current hash to grace period (24h)
      const previousHash = existingAgent.apiKey?.value || null;

      await this.agentRepository.update(AgentId.fromNumber(agentId), {
        apiKeyHash: hash,
        apiKeyPrefix: prefix,
        previousApiKeyHash: previousHash,
        previousApiKeyExpiresAt: previousHash ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
      });

      return {
        success: true,
        data: { apiKey: plaintext, prefix }
      };
    } catch (error) {
      logger.error("Error regenerating API key", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to regenerate API key"
      };
    }
  }

  /**
   * Get agents by owner
   * AIDEV-NOTE: Now returns DTOs for consistent serialization
   */
  async getAgentsByOwner(ownerId: string): Promise<AgentDTO[]> {
    const agents = await this.agentRepository.findByOwner(UserId.fromString(ownerId));
    return agents.map(agent => AgentMapper.toDTO(agent));
  }

  /**
   * Get agent by name within an organization
   * Used for @agent:name mention resolution
   */
  async getAgentByName(name: string, organizationId: number): Promise<Result<AgentDTO>> {
    try {
      const orgId = OrganizationId.fromNumber(organizationId);
      const agents = await this.agentRepository.findByOrganization(orgId);

      // Case-insensitive match, normalize hyphens/underscores to spaces
      // so @agent:email-analyzer matches "Email Analyzer"
      const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ');
      const nameNorm = normalize(name);
      const found = agents.find(agent => normalize(agent.name) === nameNorm);

      if (!found) {
        return {
          success: false,
          error: `Agent '${name}' not found`
        };
      }

      return {
        success: true,
        data: AgentMapper.toDTO(found)
      };
    } catch (error) {
      logger.error("Error finding agent by name", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to find agent"
      };
    }
  }

  /**
   * Activate/deactivate agent
   * AIDEV-NOTE: Now returns DTO for consistent serialization
   */
  async toggleAgentStatus(agentId: number): Promise<Result<AgentDTO>> {
    try {
      const existingAgent = await this.agentRepository.findById(AgentId.fromNumber(agentId));
      if (!existingAgent) {
        return {
          success: false,
          error: `Agent with ID ${agentId} not found`
        };
      }

      const newStatusValue = existingAgent.status.value === 'active' ? 'inactive' : 'active';
      const newStatus = AgentStatus.fromString(newStatusValue);

      // Update agent with new status
      const savedAgent = await this.agentRepository.update(AgentId.fromNumber(agentId), {
        status: newStatus
      });

      // Convert domain entity to DTO for serialization
      const agentDTO = AgentMapper.toDTO(savedAgent);

      return {
        success: true,
        data: agentDTO
      };
    } catch (error) {
      logger.error("Error toggling agent status", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle agent status"
      };
    }
  }

  /**
   * Convert AutomationConfigurationDTO[] to AutomationConfiguration[]
   * Helper method for DTO-to-domain conversion
   */
  private automationsFromDTOs(dtos: import('@/app/dtos/automation.dto').AutomationConfigurationDTO[]): AutomationConfiguration[] {
    return dtos.map(dto => ({
      trigger: TriggerConfigFromJSON(dto.trigger),
      skillId: dto.skillId,
      inputMappings: dto.inputMappings?.map(m => ({
        triggerField: m.triggerField,
        skillInputName: m.skillInputName
      })),
      enabled: dto.enabled,
      name: dto.name,
      description: dto.description
    }));
  }
}