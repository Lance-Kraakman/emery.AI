'use server'

import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getAgentPermissionsApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";
import type { AgentTaskPermissions, UpdateAgentPermissionsRequest } from "@/ddd/application/services/agents/agent-permissions-application-service";

export async function getAgentPermissions(agentId: number): Promise<Result<AgentTaskPermissions>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

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
  });
}

export async function updateAgentPermissions(
  agentId: number, 
  permissions: AgentTaskPermissions
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:manage");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

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
  });
}

export async function getAllAgentPermissionsForOrganization(): Promise<Result<Array<{
  agentId: number;
  agentName: string;
  permissions: AgentTaskPermissions;
}>>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("agents:view");
    const currentOrg = await requireCurrentOrganization();
    const agentPermissionsService = getAgentPermissionsApplicationService();

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
  });
}