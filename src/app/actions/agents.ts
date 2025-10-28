'use server'

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { createAgentSchema, updateAgentSchema, parseFormDataToAgent } from "@/lib/schemas";
import { type Result, type CreateAgentData, type CreateAgentClientData } from "./types";
import { getAgentApplicationService } from "@/ddd/application/di/container";
import type { CreateAgentDTO, UpdateAgentDTO, AgentFiltersDTO, AgentDTO } from "@/app/dtos/agent.dto";
import { AgentId, OrganizationId, UserId, AgentStatus } from '@/ddd/domain/shared/value-objects';
import { AgentMapper } from "@/app/mappers/agent-mapper";
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required
// AIDEV-NOTE: Now using DTOs directly instead of Commands for simplified architecture

export async function createAgent(data: CreateAgentData, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
      const agentApplicationService = getAgentApplicationService();

      // Convert tools to ToolConfigDTOs for the DTO
      const toolDTOs = data.tools?.map(tool =>
        tool instanceof ToolConfig ? tool.toPlain() : tool
      );

      // Build DTO - Application Service handles Value Object conversion
      const dto: CreateAgentDTO = {
        name: data.name,
        role: data.role,
        description: data.description,
        persona: data.persona,
        ownerId: session.user.id,
        organizationId: session.user.currentOrganizationId,
        tools: toolDTOs,
        servers: data.servers,
        status: (() => {
          const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
          return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived')
            ? statusValue as 'active' | 'inactive' | 'archived'
            : 'active';
        })()
      };

      const result = await agentApplicationService.createAgent(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to create agent"
        };
      }

      // Note: RAG reindexing is now handled automatically by database triggers

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/manage'); // Default path for agent operations
      }

      // Application service now returns DTO directly
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error creating agent:", error);
      return {
        success: false,
        error: "Failed to create agent",
      };
    }
  });
}

// Helper function for creating agents from client data (with plain types)
export async function createAgentFromClient(data: CreateAgentClientData): Promise<Result> {
  // Convert plain tools to ToolConfig instances (filter out nulls/undefined first)
  const tools = data.tools
    ?.filter(tool => tool != null) // catches both null and undefined
    ?.map(plainTool => ToolConfig.fromPlain(plainTool));

  // AIDEV-NOTE: Serialize TriggerConfig instances to JSON for database storage
  const schedules = data.schedules
    ?.filter(schedule => schedule != null)
    ?.map(schedule => {
      if (schedule && typeof schedule === 'object' && 'toJSON' in schedule && typeof schedule.toJSON === 'function') {
        return schedule.toJSON();
      }
      return schedule;
    });

  // Convert client data to domain data format
  const domainData: CreateAgentData = {
    ...data,
    tools,
    schedules: schedules || data.schedules,
    status: data.status ? AgentStatus.fromString(data.status) : AgentStatus.active(),
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
    ownerId: data.ownerId ? UserId.fromString(data.ownerId) : undefined,
  };
  return createAgent(domainData);
}

// Helper function for updating agents from client data (with plain types)
export async function updateAgentFromClient(agentId: number, data: Partial<CreateAgentClientData>, revalidateUrl?: string): Promise<Result> {
  // Convert plain tools to ToolConfig instances (filter out invalid tools first)
  const tools = data.tools
    ?.filter(tool => tool !== null && tool !== undefined)
    ?.map(plainTool => ToolConfig.fromPlain(plainTool)) || [];

  // AIDEV-NOTE: Serialize TriggerConfig instances to JSON for database storage
  // TriggerConfig.toJSON() must be called to convert class instances to plain objects
  // Otherwise Drizzle receives class instances and serializes them as empty objects
  const schedules = data.schedules
    ?.filter(schedule => schedule !== null && schedule !== undefined)
    ?.map(schedule => {
      // If it's a TriggerConfig instance with toJSON method, serialize it
      if (schedule && typeof schedule === 'object' && 'toJSON' in schedule && typeof schedule.toJSON === 'function') {
        return schedule.toJSON();
      }
      // If it's already a plain object, keep it as-is
      return schedule;
    });

  // Convert client data to domain data format
  const domainData: Partial<CreateAgentData> = {
    ...data,
    tools,
    schedules: schedules !== undefined ? schedules : data.schedules,
    status: data.status ? AgentStatus.fromString(data.status) : undefined,
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
    ownerId: data.ownerId ? UserId.fromString(data.ownerId) : undefined,
  };

  return updateAgent(agentId, domainData, revalidateUrl);
}

export async function createAgentAction(formData: FormData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const currentOrg = await requireCurrentOrganization();
      
      // Parse form data
      const rawData = parseFormDataToAgent(formData);
      const dataWithOrg = { ...rawData, organizationId: currentOrg.id };
      
      // Validate using Zod schema
      const validatedData = createAgentSchema.parse(dataWithOrg);
      
      // Parse tools and servers from form if they exist
      const toolsStr = formData.get('tools') as string;
      const serversStr = formData.get('servers') as string;
      
      const tools = toolsStr
        ? toolsStr.split(',')
            .map(t => t.trim())
            .filter(t => t)
            .map(toolName => ToolConfig.create(toolName, {})) // Create proper ToolConfig instances
        : undefined;
      
      const servers = serversStr 
        ? serversStr.split(',')
            .map(s => s.trim())
            .filter(s => s)
            .map(serverName => ({ name: serverName })) // Simple format, can be enhanced later
        : undefined;

      const result = await createAgentFromClient({ 
        ...validatedData,
        organizationId: currentOrg.id,
        tools, 
        servers,
        status: 'active' // Use plain string - will be converted to AgentStatus
      });
      
      return result;
    } catch (error) {
      console.error("Error in createAgentAction:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create agent",
      };
    }
  });
}

export async function getAgents(filters: { teamId?: number | string, searchQuery?: string, status?: 'active' | 'inactive' | 'archived' } = {}): Promise<AgentDTO[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:view");
      const currentOrg = await requireCurrentOrganization();
      const agentApplicationService = getAgentApplicationService();

      // Build DTO filter - Application Service handles Value Object conversion
      const agentFilters: AgentFiltersDTO = {
        organizationId: currentOrg.id,
        teamId: filters.teamId,
        searchQuery: filters.searchQuery,
        status: filters.status
      };

      // Application service now returns DTOs directly
      return await agentApplicationService.getAgents(agentFilters);
    } catch (error) {
      console.error("Error fetching agents:", error);
      throw new Error("Failed to fetch agents");
    }
  });
}

export async function getAgent(agentId: number) {
  return withAuthContext(async () => {
    try {
      if (!agentId) {
        throw new Error("agentId is required");
      }

      const session = await requirePermission("agents:view");
    const agentApplicationService = getAgentApplicationService();
    
    const domainAgent = await agentApplicationService.getAgent(AgentId.fromNumber(agentId));
    
    if (!domainAgent) {
      return null;
    }
    
    // Map domain entity to DTO for client serialization
    return AgentMapper.toDTO(domainAgent);
  } catch (error) {
      console.error("Error fetching agent:", error);
      throw new Error("Failed to fetch agent");
    }
  });
}

export async function updateAgent(agentId: number, data: Partial<CreateAgentData>, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!agentId) {
        return {
          success: false,
          error: "agentId is required",
        };
      }

      // Check resource-specific permission for updating this specific agent
      const session = await requireResourcePermission("agents:manage", "agent", agentId);
      const agentApplicationService = getAgentApplicationService();

      // Convert tools to ToolConfigDTOs
      const toolDTOs = data.tools?.map(tool =>
        tool instanceof ToolConfig ? tool.toPlain() : tool
      );

      // Build DTO - Application Service handles Value Object conversion
      const dto: UpdateAgentDTO = {
        id: agentId,
        name: data.name,
        role: data.role,
        description: data.description,
        persona: data.persona,
        ownerId: data.ownerId instanceof UserId ? data.ownerId.value : data.ownerId,
        tools: toolDTOs,
        servers: data.servers,
        status: (() => {
          const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
          return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived')
            ? statusValue as 'active' | 'inactive' | 'archived'
            : undefined;
        })()
      };

      const result = await agentApplicationService.updateAgent(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to update agent"
        };
      }

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/manage'); // Default path for agent operations
      }

      // Application service now returns DTO directly
      return {
        success: true,
        data: result.data,
      };
  } catch (error) {
    console.error("Error updating agent:", error);
      return {
        success: false,
        error: "Failed to update agent",
      };
    }
  });
}

export async function deleteAgent(agentId: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      if (!agentId) {
        return {
          success: false,
          error: "agentId is required",
        };
      }

      const session = await requirePermission("agents:manage");
    const agentApplicationService = getAgentApplicationService();
    
    const result = await agentApplicationService.deleteAgent(AgentId.fromNumber(agentId));

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to delete agent"
      };
    }

    // Revalidate the appropriate path
    if (revalidateUrl) {
      revalidatePath(revalidateUrl);
    } else {
      revalidatePath('/manage'); // Default path for agent operations
    }
    
    return {
      success: true,
      data: { message: "Agent deleted successfully" },
    };
  } catch (error) {
    console.error("Error deleting agent:", error);
      return {
        success: false,
        error: "Failed to delete agent",
      };
    }
  });
}
