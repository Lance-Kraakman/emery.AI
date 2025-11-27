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
import { TriggerConfig } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { CreateAgentDTO, UpdateAgentDTO, AgentFiltersDTO, AgentDTO } from '@/app/dtos/agent.dto';
import { AgentMapper } from '@/app/mappers/agent-mapper';
import { ScheduleMapper } from '@/app/mappers/schedule-mapper';
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
  async createAgent(dto: CreateAgentDTO): Promise<Result<AgentDTO>> {
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

      // Generate API key for agent authentication
      const apiKey = ApiKey.generate();

      // Create agent data with defaults - ensure required fields are set
      const agentData: CreateAgentData = {
        name: dto.name.trim(),
        role: dto.role,
        description: dto.description,
        persona: dto.persona,
        ownerId,
        organizationId,
        // Convert ScheduleConfigurationDTO[] to ScheduleConfiguration[]
        schedules: dto.schedules ? ScheduleMapper.fromDTOs(dto.schedules) : [],
        status: dto.status ? AgentStatus.fromString(dto.status) : undefined
      };

      // Apply defaults and add generated fields
      const agentWithDefaults = createAgentDefaults(agentData);

      // Create agent via repository
      const createData: CreateAgentData = {
        name: agentWithDefaults.name,
        role: agentWithDefaults.role,
        description: agentWithDefaults.description,
        persona: agentWithDefaults.persona,
        schedules: agentWithDefaults.schedules,
        organizationId: organizationId,
        ownerId: ownerId,
        status: agentWithDefaults.status,
        databaseId: agentWithDefaults.databaseId
      };

      const savedAgent = await this.agentRepository.create(createData);

      // SECURITY: Auto-create credential delegation for owner's OAuth services
      if (this.delegationService && this.connectionService) {
        try {
          logger.debug('Creating automatic credential delegation', {
            agentId: savedAgent.id.value,
            ownerId: savedAgent.ownerId.value
          });

          // Get owner's connected OAuth services
          const connectionsResult = await this.connectionService.getUserConnections(
            savedAgent.ownerId
          );

          if (connectionsResult.success && connectionsResult.data) {
            const services = connectionsResult.data.map(conn => conn.appName);

            if (services.length > 0) {
              // Create auto-approved delegation for all owner's services
              await this.delegationService.createDelegation({
                ownerId: savedAgent.ownerId,
                agentId: savedAgent.id,
                services,
                status: 'approved' as any // Auto-approve for owner's own agent
              });

              logger.summary('Auto-created credential delegation', {
                agentId: savedAgent.id.value,
                serviceCount: services.length,
                services: services.map(s => s.value)
              });
            } else {
              logger.debug('No OAuth services to delegate', {
                agentId: savedAgent.id.value
              });
            }
          }
        } catch (delegationError) {
          // Log but don't fail agent creation if delegation fails
          logger.error('Failed to create automatic delegation', delegationError);
        }
      }

      // Convert domain entity to DTO for serialization
      const agentDTO = AgentMapper.toDTO(savedAgent);

      return {
        success: true,
        data: agentDTO
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
        hasSchedules: !!dto.schedules,
        scheduleCount: dto.schedules?.length,
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
      // Convert ScheduleConfigurationDTO[] to ScheduleConfiguration[]
      if (dto.schedules !== undefined) updateData.schedules = ScheduleMapper.fromDTOs(dto.schedules);
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.avatarConfig !== undefined) updateData.avatarConfig = dto.avatarConfig;
      if (dto.defaultModel !== undefined) updateData.defaultModel = dto.defaultModel;

      // LOGGING: Update data prepared
      logger.debug('Update data prepared for repository', {
        agentId: dto.id,
        updateDataKeys: Object.keys(updateData),
        hasSchedules: !!updateData.schedules,
        scheduleCount: updateData.schedules?.length,
        schedules: updateData.schedules
      });

      // Update agent via repository
      const savedAgent = await this.agentRepository.update(agentId, updateData);

      // LOGGING: Agent updated successfully
      logger.debug('Agent updated successfully', {
        agentId: savedAgent.id.value,
        scheduleCount: savedAgent.schedules?.length
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
  async regenerateApiKey(agentId: number): Promise<Result<{ apiKey: string }>> {
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
      
      // Update agent with new API key
      const savedAgent = await this.agentRepository.update(AgentId.fromNumber(agentId), {
        apiKey: newApiKey.value
      });

      return {
        success: true,
        data: { apiKey: newApiKey.value }
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

}