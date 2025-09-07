'use server'

import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTeamPermissionsApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";
import type { TeamTaskPermissions, UpdateTeamPermissionsRequest } from "@/ddd/application/services/teams/team-permissions-application-service";

export async function getTeamPermissions(teamId: number): Promise<Result<TeamTaskPermissions>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("manage_teams");
    const currentOrg = await requireCurrentOrganization();
    const teamPermissionsService = getTeamPermissionsApplicationService();

    const result = await teamPermissionsService.getTeamTaskPermissions({
      teamId,
      organizationId: currentOrg.id.value
    });

    return result;
  } catch (error) {
    console.error("Error getting team permissions:", error);
      return {
        success: false,
        error: "Failed to get team permissions"
      };
    }
  });
}

export async function updateTeamPermissions(
  teamId: number, 
  permissions: TeamTaskPermissions
): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("manage_teams");
    const currentOrg = await requireCurrentOrganization();
    const teamPermissionsService = getTeamPermissionsApplicationService();

    const request: UpdateTeamPermissionsRequest = {
      teamId,
      permissions,
      updatedBy: session.user.id,
      organizationId: currentOrg.id.value
    };

    const result = await teamPermissionsService.updateTeamTaskPermissions(request);
    
    return result;
  } catch (error) {
    console.error("Error updating team permissions:", error);
      return {
        success: false,
        error: "Failed to update team permissions"
      };
    }
  });
}

export async function getAllTeamPermissionsForOrganization(): Promise<Result<Array<{
  teamId: number;
  teamName: string;
  permissions: TeamTaskPermissions;
}>>> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("view_teams");
    const currentOrg = await requireCurrentOrganization();
    const teamPermissionsService = getTeamPermissionsApplicationService();

    const result = await teamPermissionsService.getAllTeamPermissionsForOrganization(currentOrg.id.value);
    
    return result;
  } catch (error) {
    console.error("Error getting organization team permissions:", error);
      return {
        success: false,
        error: "Failed to get organization team permissions"
      };
    }
  });
}