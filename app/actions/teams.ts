'use server'

import { db } from "@/lib/db/client";
import { teams, teamMemberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult, CreateTeamData, TeamMembershipData } from "./types";

export async function createTeam(data: CreateTeamData): Promise<ActionResult> {
  try {
    const { organizationId, name, purpose, description, responsibilities, goals, tools } = data;

    if (!organizationId || !name) {
      return {
        success: false,
        error: "organizationId and name are required",
      };
    }

    const [newTeam] = await db.insert(teams).values({
      organizationId,
      name,
      purpose,
      description,
      responsibilities,
      goals,
      tools,
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newTeam,
    };
  } catch (error) {
    console.error("Error creating team:", error);
    return {
      success: false,
      error: "Failed to create team",
    };
  }
}

export async function createTeamAction(formData: FormData) {
  const organizationId = parseInt(formData.get('organizationId') as string);
  const name = formData.get('name') as string;
  const purpose = formData.get('purpose') as string;
  const description = formData.get('description') as string;
  const responsibilitiesStr = formData.get('responsibilities') as string;
  const goalsStr = formData.get('goals') as string;
  const toolsStr = formData.get('tools') as string;
  
  const responsibilities = responsibilitiesStr ? responsibilitiesStr.split(',').map(r => r.trim()) : undefined;
  const goals = goalsStr ? goalsStr.split(',').map(g => g.trim()) : undefined;
  const tools = toolsStr ? toolsStr.split(',').map(t => t.trim()) : undefined;

  const result = await createTeam({ 
    organizationId, 
    name, 
    purpose, 
    description, 
    responsibilities, 
    goals, 
    tools 
  });
  
  if (!result.success) {
    throw new Error(result.error);
  }

  revalidatePath('/dashboard');
  return result;
}

export async function getTeams(organizationId?: number) {
  try {
    let query = db.select().from(teams);
    
    if (organizationId) {
      query = query.where(eq(teams.organizationId, organizationId));
    }

    const allTeams = await query;
    return allTeams;
  } catch (error) {
    console.error("Error fetching teams:", error);
    throw new Error("Failed to fetch teams");
  }
}

export async function getTeam(teamId: number) {
  try {
    if (!teamId) {
      throw new Error("teamId is required");
    }

    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    return team;
  } catch (error) {
    console.error("Error fetching team:", error);
    throw new Error("Failed to fetch team");
  }
}

export async function updateTeam(teamId: number, data: Partial<CreateTeamData>): Promise<ActionResult> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: "teamId is required",
      };
    }

    const [updatedTeam] = await db
      .update(teams)
      .set(data)
      .where(eq(teams.id, teamId))
      .returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: updatedTeam,
    };
  } catch (error) {
    console.error("Error updating team:", error);
    return {
      success: false,
      error: "Failed to update team",
    };
  }
}

export async function deleteTeam(teamId: number): Promise<ActionResult> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: "teamId is required",
      };
    }

    await db.delete(teams).where(eq(teams.id, teamId));

    revalidatePath('/dashboard');
    
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
}

export async function addTeamMember(data: TeamMembershipData): Promise<ActionResult> {
  try {
    const { teamId, principalType, principalId, roleId } = data;

    if (!teamId || !principalType || !principalId) {
      return {
        success: false,
        error: "teamId, principalType, and principalId are required",
      };
    }

    const [newMembership] = await db.insert(teamMemberships).values({
      teamId,
      principalType,
      principalId,
      roleId,
    }).returning();

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: newMembership,
    };
  } catch (error) {
    console.error("Error adding team member:", error);
    return {
      success: false,
      error: "Failed to add team member",
    };
  }
}

export async function removeTeamMember(membershipId: number): Promise<ActionResult> {
  try {
    if (!membershipId) {
      return {
        success: false,
        error: "membershipId is required",
      };
    }

    await db.delete(teamMemberships).where(eq(teamMemberships.id, membershipId));

    revalidatePath('/dashboard');
    
    return {
      success: true,
      data: { message: "Team member removed successfully" },
    };
  } catch (error) {
    console.error("Error removing team member:", error);
    return {
      success: false,
      error: "Failed to remove team member",
    };
  }
}

export async function getTeamMembers(teamId: number) {
  try {
    if (!teamId) {
      throw new Error("teamId is required");
    }

    const members = await db
      .select()
      .from(teamMemberships)
      .where(eq(teamMemberships.teamId, teamId));

    return members;
  } catch (error) {
    console.error("Error fetching team members:", error);
    throw new Error("Failed to fetch team members");
  }
}