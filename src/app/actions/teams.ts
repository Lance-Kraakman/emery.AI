'use server'

// AIDEV-NOTE: Server Actions for team management using TeamApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { withAuthContext } from '@/lib/auth/with-context';
import { getTeamApplicationService, getAuditApplicationService } from "@/ddd/application/di/container";
import { AgentId } from "@/ddd/domain/shared/value-objects";
import { createTeamSchema, parseFormDataToTeam } from "@/lib/schemas";
import type { Result, CreateTeamData, CreateTeamClientData } from "./types";
import type { CreateTeamDTO, UpdateTeamDTO, TeamFiltersDTO } from "@/app/dtos/team.dto";
import { TeamId, OrganizationId } from "@/ddd/domain/shared/value-objects";
import { TeamMapper, type TeamDTO } from "@/app/mappers/team-mapper";

// Import the DI setup to ensure container is initialized
// AIDEV-NOTE: DIContainer now auto-initializes, no manual setup required

// Helper function for creating teams from client data (with plain types)
export async function createTeamFromClient(data: CreateTeamClientData): Promise<Result> {
  // No conversion needed for teams since they use the same plain types
  return withAuthContext(() => createTeam(data));
}

/**
 * Create a default team with minimal data
 * Used for quick creation from sidebar + button
 */
export async function createDefaultTeam(): Promise<Result> {
  // createTeamFromClient already uses withAuthContext, no need to wrap again
  const defaultData: CreateTeamClientData = {
    name: "Untitled Team",
    purpose: "",
    description: "",
    organizationId: 0, // Will be set by createTeam from session
  };
  return createTeamFromClient(defaultData);
}

// Helper function for updating teams from client data (with plain types)
export async function updateTeamFromClient(teamId: number, data: Partial<CreateTeamClientData>): Promise<Result> {
  // No conversion needed for teams since they use the same plain types
  return withAuthContext(() => updateTeam(teamId, data));
}

export async function createTeam(data: CreateTeamData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
    const currentOrg = await requireCurrentOrganization();
    const { name, purpose, description, responsibilities, goals, agentIds } = data;

    const teamApplicationService = getTeamApplicationService();

    const dto: CreateTeamDTO = {
      name,
      purpose,
      description,
      responsibilities,
      goals,
      agentIds,
      organizationId: currentOrg.id,
      ownerId: session.user.id
    };

    const result = await teamApplicationService.createTeam(dto);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to create team"
      };
    }

    // AUDIT: Log team creation
    const auditService = getAuditApplicationService();
    auditService.logEvent(
      OrganizationId.fromNumber(currentOrg.id),
      {
        eventType: 'security',
        eventCategory: 'team_crud',
        eventAction: 'create',
        actorType: 'user',
        actorId: session.user.id,
        actorName: session.user.name || undefined,
        resourceType: 'team',
        resourceId: String(result.data.id),
        resourceName: result.data.name,
        eventData: { purpose: data.purpose, agentCount: agentIds?.length || 0 },
        success: true,
      }
    );

    // Note: RAG reindexing is now handled automatically by database triggers

    // Revalidate paths
    revalidatePath('/dashboard');
    revalidatePath('/teams');

    // Map domain entity to DTO for client serialization
    const teamDTO = result.data;

    return {
      success: true,
      data: teamDTO,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error creating team:", error);
      return {
        success: false,
        error: "Failed to create team",
      };
    }
  });
}

export async function createTeamAction(formData: FormData): Promise<Result> {
  try {
    // Parse and validate form data
    const rawData = parseFormDataToTeam(formData);
    const validatedData = createTeamSchema.parse(rawData);

    const result = await createTeam(validatedData);
    
    if (!result.success) {
      return result;
    }

    revalidatePath('/dashboard');
    revalidatePath('/teams');
    return result;
  } catch (error) {
    console.error("Error in createTeamAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create team",
    };
  }
}

export async function getTeams(organizationId?: number): Promise<TeamDTO[]> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:view");
      const currentOrg = await requireCurrentOrganization();
      
      const teamApplicationService = getTeamApplicationService();

      const filters: TeamFiltersDTO = {
        organizationId: organizationId || currentOrg.id
      };
      
      const teams = await teamApplicationService.getTeams(filters);
      return teams.map(TeamMapper.toDTO);
    } catch (error) {
      console.error("Error fetching teams:", error);
      throw new Error("Failed to fetch teams");
    }
  });
}

export async function getTeam(teamId: number) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:view");
      
      if (!teamId) {
        throw new Error("teamId is required");
      }

      const teamApplicationService = getTeamApplicationService();
      const domainTeam = await teamApplicationService.getTeam(teamId);
      
      if (!domainTeam) {
        return null;
      }
      
      // Map domain entity to DTO for client serialization
      return TeamMapper.toDTO(domainTeam);
    } catch (error) {
      console.error("Error fetching team:", error);
      throw new Error("Failed to fetch team");
    }
  });
}

export async function updateTeam(teamId: number, data: Partial<CreateTeamData>): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!teamId) {
        return {
          success: false,
          error: "teamId is required",
        };
      }

      const teamApplicationService = getTeamApplicationService();
      
      const dto: UpdateTeamDTO = {
        id: teamId,
        name: data.name,
        purpose: data.purpose,
        description: data.description,
        responsibilities: data.responsibilities,
        goals: data.goals,
        agentIds: data.agentIds
      };

      const result = await teamApplicationService.updateTeam(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to update team"
        };
      }

      // AUDIT: Log team update
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'team_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'team',
          resourceId: String(teamId),
          resourceName: result.data.name,
          eventData: { updatedFields: Object.keys(data) },
          success: true,
        }
      );

      // Note: RAG reindexing is now handled automatically by database triggers
      revalidatePath('/dashboard');
      revalidatePath('/teams');

      // Map domain entity to DTO for client serialization
      const teamDTO = result.data;

      return {
        success: true,
        data: teamDTO,
        warnings: result.warnings
      };
    } catch (error) {
      console.error("Error updating team:", error);
      return {
        success: false,
        error: "Failed to update team",
      };
    }
  });
}

export async function deleteTeam(teamId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!teamId) {
        return {
          success: false,
          error: "teamId is required",
        };
      }

      const teamApplicationService = getTeamApplicationService();

      // AUDIT: Get team name BEFORE deletion
      const teamToDelete = await teamApplicationService.getTeam(teamId);
      const teamName = teamToDelete?.name;

      const result = await teamApplicationService.deleteTeam(teamId);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to delete team"
        };
      }

      // AUDIT: Log team deletion
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'team_crud',
          eventAction: 'delete',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'team',
          resourceId: String(teamId),
          resourceName: teamName,
          eventData: {},
          success: true,
        }
      );

      // Note: RAG reindexing is now handled automatically by database triggers
      revalidatePath('/dashboard');
      revalidatePath('/teams');

      return {
        success: true,
        data: { message: "Team deleted successfully" },
      };
    } catch (error) {
      console.error("Error deleting team:", error);
      return {
        success: false,
        error: "Failed to delete team",
      };
    }
  });
}

/**
 * Duplicate an existing team
 * Appends " (Copy)" to the team name and copies all agent assignments
 */
export async function duplicateTeam(teamId: number): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!teamId) {
        return {
          success: false,
          error: "teamId is required",
        };
      }

      const teamApplicationService = getTeamApplicationService();

      // Get the original team
      const originalTeam = await teamApplicationService.getTeam(teamId);
      if (!originalTeam) {
        return { success: false, error: "Team not found" };
      }

      // Create new name with " (Copy)" suffix
      const newName = `${originalTeam.name} (Copy)`;

      // Build DTO for the duplicate
      const dto: CreateTeamDTO = {
        name: newName,
        purpose: originalTeam.purpose || undefined,
        description: originalTeam.description || undefined,
        responsibilities: originalTeam.responsibilities || undefined,
        goals: originalTeam.goals || undefined,
        agentIds: originalTeam.agentIds?.map(id => id.value.toString()) || undefined,
        organizationId: currentOrg.id,
        ownerId: session.user.id
      };

      const result = await teamApplicationService.createTeam(dto);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to duplicate team"
        };
      }

      revalidatePath('/dashboard');
      revalidatePath('/teams');

      return {
        success: true,
        data: result.data,
        warnings: result.warnings
      };
    } catch (error) {
      console.error("Error duplicating team:", error);
      return {
        success: false,
        error: "Failed to duplicate team",
      };
    }
  });
}

// AIDEV-NOTE: Team memberships are now managed through agent assignments
// This function adds an agent to a team instead of a user membership
export async function addAgentToTeam(teamId: number, agentId: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!teamId || !agentId) {
        return {
          success: false,
          error: "teamId and agentId are required",
        };
      }

      const teamApplicationService = getTeamApplicationService();
      const result = await teamApplicationService.addAgentToTeam(teamId, agentId);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to add agent to team"
        };
      }

      // AUDIT: Log agent added to team
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'team_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'team',
          resourceId: String(teamId),
          resourceName: result.data.name,
          eventData: { action: 'add_agent', agentId },
          success: true,
        }
      );

      revalidatePath('/dashboard');
      revalidatePath('/teams');

      // Map domain entity to DTO for client serialization
      const teamDTO = result.data;

      return {
        success: true,
        data: teamDTO,
        warnings: result.warnings
      };
    } catch (error) {
      console.error("Error adding agent to team:", error);
      return {
        success: false,
        error: "Failed to add agent to team",
      };
    }
  });
}

// AIDEV-NOTE: Team memberships are now managed through agent assignments
// This function removes an agent from a team instead of a user membership
export async function removeAgentFromTeam(teamId: number, agentId: string): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      const currentOrg = await requireCurrentOrganization();

      if (!teamId || !agentId) {
        return {
          success: false,
          error: "teamId and agentId are required",
        };
      }

      const teamApplicationService = getTeamApplicationService();

      // Get team name for audit log
      const team = await teamApplicationService.getTeam(teamId);
      const teamName = team?.name;

      const result = await teamApplicationService.removeAgentFromTeam(teamId, agentId);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to remove agent from team"
        };
      }

      // AUDIT: Log agent removed from team
      const auditService = getAuditApplicationService();
      auditService.logEvent(
        OrganizationId.fromNumber(currentOrg.id),
        {
          eventType: 'security',
          eventCategory: 'team_crud',
          eventAction: 'update',
          actorType: 'user',
          actorId: session.user.id,
          actorName: session.user.name || undefined,
          resourceType: 'team',
          resourceId: String(teamId),
          resourceName: teamName,
          eventData: { action: 'remove_agent', agentId },
          success: true,
        }
      );

      revalidatePath('/dashboard');
      revalidatePath('/teams');

      return {
        success: true,
        data: { message: "Agent removed from team successfully" },
      };
    } catch (error) {
      console.error("Error removing agent from team:", error);
      return {
        success: false,
        error: "Failed to remove agent from team",
      };
    }
  });
}

// AIDEV-NOTE: Team members are now represented by agents assigned to the team
// Get the team details which includes agent information
export async function getTeamAgents(teamId: number) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:view");
      
      if (!teamId) {
        throw new Error("teamId is required");
      }

      const teamApplicationService = getTeamApplicationService();
      const team = await teamApplicationService.getTeam(teamId);
      
      if (!team) {
        throw new Error("Team not found");
      }

      // Return agent IDs - the UI can fetch full agent details if needed
      return {
        teamId: team.id,
        agentIds: team.agentIds || []
      };
    } catch (error) {
      console.error("Error fetching team agents:", error);
      throw new Error("Failed to fetch team agents");
    }
  });
}

// Legacy compatibility function - kept for existing UI components
export async function getTeamMembers(teamId: number) {
  return getTeamAgents(teamId);
}

/**
 * Alias for addAgentToTeam for legacy compatibility
 */
export async function addTeamMember(teamId: number, agentId: string): Promise<Result> {
  return addAgentToTeam(teamId, agentId);
}

/**
 * Alias for removeAgentFromTeam for legacy compatibility
 */
export async function removeTeamMember(teamId: number, agentId: string): Promise<Result> {
  return removeAgentFromTeam(teamId, agentId);
}

/**
 * Get teams that contain a specific agent
 */
export async function getTeamsForAgent(agentId: string) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:view");
      
      if (!agentId) {
        throw new Error("agentId is required");
      }

      const teamApplicationService = getTeamApplicationService();
      return await teamApplicationService.getTeamsForAgent(AgentId.fromNumber(parseInt(agentId, 10)));
    } catch (error) {
      console.error("Error fetching teams for agent:", error);
      throw new Error("Failed to fetch teams for agent");
    }
  });
}

/**
 * Get team count for an organization
 */
export async function getTeamCount(organizationId?: number) {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:view");
      const currentOrg = await requireCurrentOrganization();
      
      const teamApplicationService = getTeamApplicationService();
      const orgId = organizationId ? OrganizationId.fromNumber(organizationId) : OrganizationId.fromNumber(currentOrg.id);
      return await teamApplicationService.getTeamCount(orgId);
    } catch (error) {
      console.error("Error fetching team count:", error);
      throw new Error("Failed to fetch team count");
    }
  });
}

/**
 * Bulk assign multiple agents to a team
 */
export async function bulkAssignAgents(teamId: number, agentIds: string[]): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("teams:manage");
      
      if (!teamId || !agentIds || agentIds.length === 0) {
        return {
          success: false,
          error: "teamId and agentIds are required",
        };
      }

      const teamApplicationService = getTeamApplicationService();
      const teamIdValueObject = TeamId.fromNumber(teamId);
      const agentIdValueObjects = agentIds.map(id => AgentId.fromNumber(parseInt(id, 10)));
      const result = await teamApplicationService.bulkAssignAgents(teamIdValueObject, agentIdValueObjects);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || "Failed to assign agents to team"
        };
      }

      revalidatePath('/dashboard');
      revalidatePath('/teams');
      
      // Map domain entity to DTO for client serialization
      const teamDTO = result.data;
      
      return {
        success: true,
        data: teamDTO,
        warnings: result.warnings
      };
    } catch (error) {
      console.error("Error bulk assigning agents:", error);
      return {
        success: false,
        error: "Failed to assign agents to team",
      };
    }
  });
}
