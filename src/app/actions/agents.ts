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
import type { UpdateAgentData } from '@/ddd/domain/agents/entities/agent';
import { AgentMapper } from "@/app/mappers/agent-mapper";

// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required
// AIDEV-NOTE: Now using DTOs directly instead of Commands for simplified architecture

export async function createAgent(data: CreateAgentData, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
      const agentApplicationService = getAgentApplicationService();

      // Serialize automations if they're AutomationConfiguration instances
      const automationDTOs = data.automations?.map(automation => {
        if (automation && typeof automation === 'object' && 'trigger' in automation &&
            automation.trigger && typeof automation.trigger === 'object' &&
            'toJSON' in automation.trigger && typeof automation.trigger.toJSON === 'function') {
          return {
            ...automation,
            trigger: automation.trigger.toJSON()
          };
        }
        return automation;
      });

      // Build DTO - Application Service handles Value Object conversion
      const dto: CreateAgentDTO = {
        name: data.name,
        role: data.role,
        description: data.description,
        persona: data.persona,
        ownerId: session.user.id,
        organizationId: session.user.currentOrganizationId,
        automations: automationDTOs as any,
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
  // AIDEV-NOTE: Serialize TriggerConfig instances to JSON for database storage
  const automations = data.automations
    ?.filter(automation => automation != null)
    ?.map(automation => {
      if (automation && typeof automation === 'object' && 'trigger' in automation &&
          automation.trigger && typeof automation.trigger === 'object' &&
          'toJSON' in automation.trigger && typeof automation.trigger.toJSON === 'function') {
        return {
          ...automation,
          trigger: automation.trigger.toJSON()
        };
      }
      return automation;
    });

  // Convert client data to domain data format
  const domainData: CreateAgentData = {
    ...data,
    automations: automations || data.automations,
    status: data.status ? AgentStatus.fromString(data.status) : AgentStatus.active(),
    organizationId: data.organizationId ? OrganizationId.fromNumber(data.organizationId) : undefined,
    ownerId: data.ownerId ? UserId.fromString(data.ownerId) : undefined,
  };
  return createAgent(domainData);
}

/**
 * Create a default agent with minimal data
 * Used for quick creation from sidebar + button
 */
export async function createDefaultAgent(): Promise<Result> {
  return withAuthContext(async () => {
    const defaultData: CreateAgentClientData = {
      name: "Untitled Agent",
      role: "Assistant",
      description: "",
      persona: "",
      status: "active",
    };
    return createAgentFromClient(defaultData);
  });
}

// Helper function for updating agents from client data (with plain types)
export async function updateAgentFromClient(agentId: number, data: Partial<CreateAgentClientData>, revalidateUrl?: string): Promise<Result> {
  // AIDEV-NOTE: Serialize TriggerConfig instances to JSON for database storage
  // TriggerConfig.toJSON() must be called to convert class instances to plain objects
  // Otherwise Drizzle receives class instances and serializes them as empty objects
  const automations = data.automations
    ?.filter(automation => automation !== null && automation !== undefined)
    ?.map(automation => {
      // If it has a trigger with toJSON method, serialize the trigger
      if (automation && typeof automation === 'object' && 'trigger' in automation &&
          automation.trigger && typeof automation.trigger === 'object' &&
          'toJSON' in automation.trigger && typeof automation.trigger.toJSON === 'function') {
        return {
          ...automation,
          trigger: automation.trigger.toJSON()
        };
      }
      // If it's already a plain object, keep it as-is
      return automation;
    });

  // Convert client data to domain data format
  const domainData: Partial<CreateAgentData> = {
    ...data,
    automations: automations !== undefined ? automations : data.automations,
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

      const result = await createAgentFromClient({
        ...validatedData,
        organizationId: currentOrg.id,
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

export async function updateAgent(agentId: number, data: Partial<UpdateAgentData>, revalidateUrl?: string): Promise<Result> {
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

      // LOGGING: Start of update operation
      console.log('[agents.ts/updateAgent] Starting agent update', {
        agentId,
        hasAutomations: !!data.automations,
        automationCount: data.automations?.length,
        dataKeys: Object.keys(data)
      });

      // Serialize automations if they're AutomationConfiguration instances
      const automationDTOs = data.automations?.map(automation => {
        if (automation && typeof automation === 'object' && 'trigger' in automation &&
            automation.trigger && typeof automation.trigger === 'object' &&
            'toJSON' in automation.trigger && typeof automation.trigger.toJSON === 'function') {
          return {
            ...automation,
            trigger: automation.trigger.toJSON()
          };
        }
        return automation;
      });

      // LOGGING: Automations serialized
      if (automationDTOs) {
        console.log('[agents.ts/updateAgent] Automations serialized', {
          count: automationDTOs.length,
          automations: automationDTOs
        });
      }

      // Build DTO - Application Service handles Value Object conversion
      const dto: UpdateAgentDTO = {
        id: agentId,
        name: data.name,
        role: data.role,
        description: data.description,
        persona: data.persona,
        ownerId: data.ownerId instanceof UserId ? data.ownerId.value : data.ownerId,
        automations: automationDTOs as any,
        status: (() => {
          const statusValue = typeof data.status === 'string' ? data.status : data.status?.value;
          return (statusValue === 'active' || statusValue === 'inactive' || statusValue === 'archived')
            ? statusValue as 'active' | 'inactive' | 'archived'
            : undefined;
        })(),
        avatarConfig: data.avatarConfig,
        defaultModel: data.defaultModel
      };

      // LOGGING: DTO built, calling application service
      console.log('[agents.ts/updateAgent] DTO built, calling application service', {
        dto,
        hasAutomations: !!dto.automations,
        automationCount: dto.automations?.length
      });

      const result = await agentApplicationService.updateAgent(dto);

      // LOGGING: Application service result
      console.log('[agents.ts/updateAgent] Application service result', {
        success: result.success,
        hasData: !!result.data,
        error: result.error
      });

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
      console.log('[agents.ts/updateAgent] Update successful, revalidated paths');
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

/**
 * Duplicate an existing agent
 * Appends " (Copy)" to the agent name
 */
export async function duplicateAgent(agentId: number, revalidateUrl?: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!agentId) {
        return {
          success: false,
          error: "agentId is required",
        };
      }

      const agentApplicationService = getAgentApplicationService();

      // Get the original agent
      const originalAgent = await agentApplicationService.getAgent(AgentId.fromNumber(agentId));
      if (!originalAgent) {
        return { success: false, error: "Agent not found" };
      }

      // Create new name with " (Copy)" suffix
      const newName = `${originalAgent.name} (Copy)`;

      // Build DTO for the duplicate
      const dto: CreateAgentDTO = {
        name: newName,
        role: originalAgent.role,
        description: originalAgent.description,
        persona: originalAgent.persona,
        ownerId: session.user.id,
        organizationId: currentOrg.id,
        automations: originalAgent.automations as any,
        status: originalAgent.status.value as 'active' | 'inactive' | 'archived'
      };

      const result = await agentApplicationService.createAgent(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to duplicate agent"
        };
      }

      // Revalidate the appropriate path
      if (revalidateUrl) {
        revalidatePath(revalidateUrl);
      } else {
        revalidatePath('/manage');
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error("Error duplicating agent:", error);
      return {
        success: false,
        error: "Failed to duplicate agent",
      };
    }
  });
}

// =============================================================================
// Pipedream Source Deployment
// =============================================================================

export interface DeployPipedreamSourceInput {
  agentId: number;
  triggerId: string;      // Tool ID from tools table (e.g., "gmail-new-email-received")
  connectionId: string;   // User's OAuth connection ID (e.g., "apn_QPhBxVA")
  appSlug: string;        // App slug (e.g., "gmail", "slack")
  configuredProps?: Record<string, any>;
}

export interface DeployPipedreamSourceResult {
  sourceId: string;
  webhookId: string;
  subscriptionId: string;
}

/**
 * Deploy a Pipedream event source for an agent's automation trigger
 *
 * AIDEV-NOTE: This wraps the Pipedream sources service to make it available
 * as a server action. Needed because deploySource uses PIPEDREAM_API_KEY.
 */
export async function deployPipedreamSource(
  input: DeployPipedreamSourceInput
): Promise<Result<DeployPipedreamSourceResult>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
      const { agentId, triggerId, connectionId, appSlug, configuredProps } = input;

      console.log('[AgentActions] Deploying Pipedream source:', {
        agentId,
        triggerId,
        connectionId,
        appSlug,
        userId: session.user.id
      });

      // Import dynamically to avoid issues with server-only code
      const { deploySource } = await import('@/lib/pipedream/sources');

      // Build webhook URL for this agent
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const webhookUrl = `${baseUrl}/api/webhooks/pipedream/${agentId}`;

      console.log('[AgentActions] Webhook URL:', webhookUrl);

      // Deploy the source
      const result = await deploySource({
        userId: session.user.id,
        triggerId,
        webhookUrl,
        connectionId,
        appSlug,
        configuredProps
      });

      console.log('[AgentActions] Source deployed:', result);

      return {
        success: true,
        data: {
          sourceId: result.sourceId,
          webhookId: result.webhookId,
          subscriptionId: result.subscriptionId
        }
      };
    } catch (error) {
      console.error('[AgentActions] Failed to deploy Pipedream source:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deploy Pipedream source'
      };
    }
  });
}
