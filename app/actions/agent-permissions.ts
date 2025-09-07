'use server'

import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getAgentPermissionsApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";
import type { AgentTaskPermissions, UpdateAgentPermissionsRequest } from "@/ddd/application/services/agents/agent-permissions-application-service";

export async function getAgentPermissions(agentId: number): Promise<Result<AgentTaskPermissions>> {
  try {
    const session = await requirePermission("manage_agents");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

    // AIDEV-NOTE: Set RLS context for database operations
    const { contextManager } = await import('@/lib/db/context-manager');
    const { UserId } = await import('@/ddd/domain/shared/value-objects');
    contextManager.setContext(currentOrg.id, UserId.fromString(session.user.id));

    const result = await agentPermissionsService.getAgentTaskPermissions({
      agentId,
      organizationId: currentOrg.id.value
    });

    return result;
  } catch (error) {
    console.error("Error getting agent permissions:", error);
    return {
      success: false,
      error: "Failed to get agent permissions"
    };
  }
}

export async function updateAgentPermissions(
  agentId: number, 
  permissions: AgentTaskPermissions
): Promise<Result> {
  try {
    const session = await requirePermission("manage_agents");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

    // AIDEV-NOTE: Set RLS context for database operations
    const { contextManager } = await import('@/lib/db/context-manager');
    const { UserId } = await import('@/ddd/domain/shared/value-objects');
    contextManager.setContext(currentOrg.id, UserId.fromString(session.user.id));

    const request: UpdateAgentPermissionsRequest = {
      agentId,
      permissions,
      updatedBy: session.user.id,
      organizationId: currentOrg.id.value
    };

    const result = await agentPermissionsService.updateAgentTaskPermissions(request);
    
    return result;
  } catch (error) {
    console.error("Error updating agent permissions:", error);
    return {
      success: false,
      error: "Failed to update agent permissions"
    };
  }
}

export async function getAllAgentPermissionsForOrganization(): Promise<Result<Array<{
  agentId: number;
  agentName: string;
  permissions: AgentTaskPermissions;
}>>> {
  try {
    const session = await requirePermission("view_agents");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

    // AIDEV-NOTE: Set RLS context for database operations
    const { contextManager } = await import('@/lib/db/context-manager');
    const { UserId } = await import('@/ddd/domain/shared/value-objects');
    contextManager.setContext(currentOrg.id, UserId.fromString(session.user.id));

    const result = await agentPermissionsService.getAllAgentPermissionsForOrganization(currentOrg.id.value);
    
    // Map the response structure to match UI expectations
    if (result.success && result.agentPermissions) {
      return {
        success: true,
        data: result.agentPermissions
      };
    }
    
    return result;
  } catch (error) {
    console.error("Error getting organization agent permissions:", error);
    return {
      success: false,
      error: "Failed to get organization agent permissions"
    };
  }
}