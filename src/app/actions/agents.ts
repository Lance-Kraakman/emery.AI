'use server'

import { revalidatePath } from "next/cache";
import { requirePermission, requireResourcePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { createAgentSchema, updateAgentSchema, parseFormDataToAgent } from "@/lib/schemas";
import { type Result, type CreateAgentData, type CreateAgentClientData } from "./types";
import { getAgentApplicationService } from "@/ddd/application/di/container";
import type { CreateAgentDTO, UpdateAgentDTO, AgentFiltersDTO, AgentDTO } from "@/app/dtos/agent.dto";
import type { SkillConfig } from "@/ddd/domain/agents/entities/agent";
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
        trigger: data.trigger,
        skills: data.skills,
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

export async function addSkillToAgent(agentId: number, skill: SkillConfig) {
  'use server';
  return withAuthContext(async () => {
    try {
      const agentApplicationService = getAgentApplicationService();
      const result = await agentApplicationService.addSkillToAgent(AgentId.fromNumber(agentId), skill);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to add capability");
      }
      
      return result.data;
    } catch (error) {
      console.error("Error adding capability to agent:", error);
      throw error;
    }
  });
}

// Helper function for creating agents from client data (with plain types)
export async function createAgentFromClient(data: CreateAgentClientData): Promise<Result> {
  // Convert plain tools to ToolConfig instances (filter out nulls/undefined first)
  const tools = data.tools
    ?.filter(tool => tool != null) // catches both null and undefined
    ?.map(plainTool => ToolConfig.fromPlain(plainTool));

  // Convert plain capabilities to domain CapabilityConfig with ToolConfig instances
  const skills = data.skills?.map(plainSkill => ({
    name: plainSkill.name,
    description: plainSkill.description,
    steps: plainSkill.steps.map(plainStep => ({
      type: plainStep.type,
      instructions: plainStep.instructions,
      model: plainStep.model,
      // Convert plain tool configs to ToolConfig instances (filter out nulls/undefined first!)
      tools: plainStep.tools
        ?.filter(tool => tool != null) // catches both null and undefined
        ?.map(plainTool => ToolConfig.fromPlain(plainTool)) || [],
      servers: plainStep.servers || []
    }))
  }));

  // Convert client data to domain data format
  const domainData: CreateAgentData = {
    ...data,
    tools,
    skills: skills || [],
    status: data.status ? AgentStatus.fromString(data.status) : AgentStatus.active(),
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
    ownerId: data.ownerId ? UserId.fromString(data.ownerId) : undefined,
  };
  return createAgent(domainData);
}

// Helper function for updating agents from client data (with plain types)
export async function updateAgentFromClient(agentId: number, data: Partial<CreateAgentClientData>, revalidateUrl?: string): Promise<Result> {
  console.log('[updateAgentFromClient] Received plain data:', JSON.stringify({
    agentId,
    skills: data.skills,
    skillsCount: data.skills?.length || 0
  }, null, 2));

  // Log detailed tool information for debugging
  if (data.skills) {
    data.skills.forEach((skill, skillIndex) => {
      console.log(`[updateAgentFromClient] Skill ${skillIndex} "${skill.name}":`);
      skill.steps.forEach((step, stepIndex) => {
        console.log(`[updateAgentFromClient]   Step ${stepIndex} (${step.type}): ${step.tools?.length || 0} tools`);
        step.tools?.forEach((tool, toolIndex) => {
          console.log(`[updateAgentFromClient]     Tool ${toolIndex}:`, JSON.stringify(tool));
          console.log(`[updateAgentFromClient]     Tool ${toolIndex} name: "${tool?.name}"`, tool?.name === '@tool:' ? '(EMPTY PLACEHOLDER)' : '');
          console.log(`[updateAgentFromClient]     Tool ${toolIndex} is null/undefined:`, tool === null || tool === undefined);
        });
      });
    });
  }

  // Convert plain tools to ToolConfig instances (filter out invalid tools first)
  const tools = data.tools
    ?.filter(tool => {
      console.log('[updateAgentFromClient] Filtering tool:', tool);
      const isValid = tool !== null && tool !== undefined && tool !== undefined;
      console.log('[updateAgentFromClient] Tool is valid:', isValid);
      return isValid;
    })
    ?.map(plainTool => {
      console.log('[updateAgentFromClient] Converting tool to ToolConfig:', plainTool);
      return ToolConfig.fromPlain(plainTool);
    }) || [];

  // Convert plain capabilities to domain CapabilityConfig with ToolConfig instances
  const skills = data.skills?.map(plainSkill => {
    console.log('[updateAgentFromClient] Processing capability:', plainSkill.name);
    return {
      name: plainSkill.name,
      description: plainSkill.description,
      steps: plainSkill.steps.map(plainStep => {
        console.log('[updateAgentFromClient] Processing step:', plainStep.type, 'tools:', plainStep.tools);
        // Convert plain tool configs to ToolConfig instances (filter out invalid tools first!)
        const validTools = (plainStep.tools || [])
          .filter(tool => {
            console.log('[updateAgentFromClient] Filtering step tool:', tool);
            const isValid = tool !== null && tool !== undefined && tool !== undefined;
            console.log('[updateAgentFromClient] Step tool is valid:', isValid);
            return isValid;
          })
          .map(plainTool => {
            console.log('[updateAgentFromClient] Converting step tool to ToolConfig:', plainTool);
            return ToolConfig.fromPlain(plainTool);
          });
        
        console.log('[updateAgentFromClient] Valid tools after filtering:', validTools.length);
        
        return {
          type: plainStep.type,
          instructions: plainStep.instructions,
          model: plainStep.model,
          tools: validTools,
          servers: plainStep.servers || []
        };
      })
    };
  }) || [];

  // Convert client data to domain data format
  const domainData: Partial<CreateAgentData> = {
    ...data,
    tools,
    skills,
    status: data.status ? AgentStatus.fromString(data.status) : undefined,
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
    ownerId: data.ownerId ? UserId.fromString(data.ownerId) : undefined,
  };

  console.log('[updateAgentFromClient] Converted to domain data with ToolConfig instances:', JSON.stringify({
    skills: domainData.skills?.map(c => ({
      name: c.name,
      steps: c.steps.map(s => ({
        type: s.type,
        toolsCount: s.tools?.length || 0,
        tools: s.tools?.map(t => ({ name: t.name, isToolConfig: t instanceof ToolConfig }))
      }))
    }))
  }, null, 2));

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
        trigger: data.trigger,
        skills: data.skills,
        status: (() => {
          const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
          return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived')
            ? statusValue as 'active' | 'inactive' | 'archived'
            : undefined;
        })()
      };

      console.log('[updateAgent] UpdateAgentDTO skills:', JSON.stringify({
        skillsCount: dto.skills?.length || 0,
        skills: dto.skills?.map(c => ({
          name: c.name,
          stepsCount: c.steps.length,
          steps: c.steps.map(s => ({
            type: s.type,
            toolsCount: s.tools?.length || 0,
            tools: s.tools?.map(t => ({ name: t.name, config: t.config }))
          }))
        }))
      }, null, 2));

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
