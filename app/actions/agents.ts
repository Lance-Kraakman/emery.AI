'use server'

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { createAgentSchema, updateAgentSchema, parseFormDataToAgent } from "@/lib/schemas";
import type { Result, CreateAgentData, CreateAgentClientData } from "./types";
import { getAgentApplicationService } from "@/ddd/application/di/container";
import type { CreateAgentCommand, UpdateAgentCommand, AgentFilters } from "@/ddd/application/services/agents/agent-application-service";
import type { CapabilityConfig } from "@/ddd/domain/agents/entities/agent";
import { AgentId, OrganizationId, UserId, AgentStatus } from '@/ddd/domain/shared/value-objects';
import { AgentMapper, type AgentDTO } from "@/app/mappers/agent-mapper";

// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

export async function createAgent(data: CreateAgentData, revalidateUrl?: string): Promise<Result> {
  try {
    const session = await requirePermission("manage_agents");
    const agentApplicationService = getAgentApplicationService();
    
    const command: CreateAgentCommand = {
      name: data.name,
      role: data.role,
      description: data.description,
      persona: data.persona,
      ownerId: UserId.fromString(session.user.id),
      organizationId: OrganizationId.fromNumber(session.user.currentOrganizationId),
      tools: data.tools,
      servers: data.servers,
      trigger: data.trigger,
      capabilities: data.capabilities,
      status: (() => {
        const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
        return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived') 
          ? statusValue as 'active' | 'inactive' | 'archived'
          : 'active';
      })()
    };

    const result = await agentApplicationService.createAgent(command);

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
    
    // Map domain entity to DTO for client serialization
    const agentDTO = AgentMapper.toDTO(result.data);

    return {
      success: true,
      data: agentDTO,
    };
  } catch (error) {
    console.error("Error creating agent:", error);
    return {
      success: false,
      error: "Failed to create agent",
    };
  }
}

export async function addCapabilityToAgent(agentId: number, capability: CapabilityConfig) {
  'use server';
  try {
    const agentApplicationService = getAgentApplicationService();
    const result = await agentApplicationService.addCapabilityToAgent(AgentId.fromNumber(agentId), capability);
    
    if (!result.success) {
      throw new Error(result.error || "Failed to add capability");
    }
    
    return result.data;
  } catch (error) {
    console.error("Error adding capability to agent:", error);
    throw error;
  }
}

// Helper function for creating agents from client data (with plain types)
export async function createAgentFromClient(data: CreateAgentClientData): Promise<Result> {
  // Convert client data to domain data format
  const domainData: CreateAgentData = {
    ...data,
    status: data.status ? AgentStatus.fromString(data.status) : AgentStatus.active(),
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
  };
  return createAgent(domainData);
}

// Helper function for updating agents from client data (with plain types)
export async function updateAgentFromClient(agentId: number, data: Partial<CreateAgentClientData>, revalidateUrl?: string): Promise<Result> {
  // Convert client data to domain data format
  const domainData: Partial<CreateAgentData> = {
    ...data,
    status: data.status ? AgentStatus.fromString(data.status) : undefined,
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
  };
  return updateAgent(agentId, domainData, revalidateUrl);
}

export async function createAgentAction(formData: FormData): Promise<Result> {
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
          .map(toolName => ({ name: toolName })) // Simple format, can be enhanced later
      : undefined;
    
    const servers = serversStr 
      ? serversStr.split(',')
          .map(s => s.trim())
          .filter(s => s)
          .map(serverName => ({ name: serverName })) // Simple format, can be enhanced later
      : undefined;

    const result = await createAgentFromClient({ 
      ...validatedData,
      organizationId: currentOrg.id.value,
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
}

export async function getAgents(filters: { teamId?: number | string, searchQuery?: string, status?: 'active' | 'inactive' | 'archived' } = {}): Promise<AgentDTO[]> {
  try {
    const currentOrg = await requireCurrentOrganization();
    const agentApplicationService = getAgentApplicationService();
    
    const agentFilters: AgentFilters = {
      organizationId: currentOrg.id,
      teamId: filters.teamId,
      searchQuery: filters.searchQuery,
      status: filters.status
    };

    const domainAgents = await agentApplicationService.getAgents(agentFilters);
    
    // Map domain entities to DTOs for client serialization
    return domainAgents.map(AgentMapper.toDTO);
  } catch (error) {
    console.error("Error fetching agents:", error);
    throw new Error("Failed to fetch agents");
  }
}

export async function getAgent(agentId: number) {
  try {
    if (!agentId) {
      throw new Error("agentId is required");
    }

    const agentApplicationService = getAgentApplicationService();
    const domainAgent = await agentApplicationService.getAgent(AgentId.fromNumber(agentId));
    
    if (!domainAgent) {
      return null;
    }
    
    // Return domain entity directly - it already has proper defaults and types
    return domainAgent;
  } catch (error) {
    console.error("Error fetching agent:", error);
    throw new Error("Failed to fetch agent");
  }
}

export async function updateAgent(agentId: number, data: Partial<CreateAgentData>, revalidateUrl?: string): Promise<Result> {
  try {
    if (!agentId) {
      return {
        success: false,
        error: "agentId is required",
      };
    }

    const agentApplicationService = getAgentApplicationService();
    const command: UpdateAgentCommand = {
      agentId: AgentId.fromNumber(agentId),
      name: data.name,
      role: data.role,
      description: data.description,
      persona: data.persona,
      tools: data.tools,
      servers: data.servers,
      trigger: data.trigger,
      capabilities: data.capabilities,
      status: (() => {
        const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
        return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived') 
          ? statusValue as 'active' | 'inactive' | 'archived'
          : undefined;
      })()
    };

    const result = await agentApplicationService.updateAgent(command);

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
    
    // Map domain entity to DTO for client serialization
    const agentDTO = AgentMapper.toDTO(result.data);

    return {
      success: true,
      data: agentDTO,
    };
  } catch (error) {
    console.error("Error updating agent:", error);
    return {
      success: false,
      error: "Failed to update agent",
    };
  }
}

export async function deleteAgent(agentId: number, revalidateUrl?: string): Promise<Result> {
  try {
    if (!agentId) {
      return {
        success: false,
        error: "agentId is required",
      };
    }

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
}
