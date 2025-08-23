'use server'

import { db } from "@/lib/db/client";
import { teams, teamMemberships } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createTeamSchema, updateTeamSchema, parseFormDataToTeam } from "@/lib/schemas";
import type { Result, CreateTeamData, TeamMembershipData } from "./types";

export async function createTeam(data: CreateTeamData): Promise<Result> {
  try {
    const { organizationId, name, purpose, description, responsibilities, goals, agentIds } = data;

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
      agentIds,
    }).returning();

    revalidatePath('/dashboard');
    revalidatePath('/teams');

    // Note: RAG reindexing is now handled automatically by database triggers
    
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

export async function getTeams(organizationId?: number) {
  try {
    const query = db.select().from(teams).orderBy(desc(teams.createdAt));

    if (organizationId) {
      return await query.where(eq(teams.organizationId, organizationId));
    }

    return await query;
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

export async function updateTeam(teamId: number, data: Partial<CreateTeamData>): Promise<Result> {
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
    revalidatePath('/teams');

    if (updatedTeam.organizationId) {
      // Note: RAG reindexing is now handled automatically by database triggers
    }
    
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

export async function deleteTeam(teamId: number): Promise<Result> {
  try {
    if (!teamId) {
      return {
        success: false,
        error: "teamId is required",
      };
    }

    const [deletedTeam] = await db.delete(teams).where(eq(teams.id, teamId)).returning();

    revalidatePath('/dashboard');
    revalidatePath('/teams');

    if (deletedTeam?.organizationId) {
      // Note: RAG reindexing is now handled automatically by database triggers
    }
    
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

export async function addTeamMember(data: TeamMembershipData): Promise<Result> {
  try {
    const { teamId, userId } = data;

    if (!teamId || !userId) {
      return {
        success: false,
        error: "teamId and userId are required",
      };
    }

    const [newMembership] = await db.insert(teamMemberships).values({
      teamId,
      userId,
    }).returning();

    revalidatePath('/dashboard');
    revalidatePath('/teams');
    
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

export async function removeTeamMember(membershipId: number): Promise<Result> {
  try {
    if (!membershipId) {
      return {
        success: false,
        error: "membershipId is required",
      };
    }

    await db.delete(teamMemberships).where(eq(teamMemberships.id, membershipId));

    revalidatePath('/dashboard');
    revalidatePath('/teams');
    
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
