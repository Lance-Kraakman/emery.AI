'use server'

import { db } from "@/lib/db/client";
import { users, organizations, userOrganizations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "./types";

export async function switchCurrentOrganization(organizationId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Verify user is a member of the organization they want to switch to
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership.length) {
      return {
        success: false,
        error: "You are not a member of this organization",
      };
    }

    // Update user's current organization
    await db
      .update(users)
      .set({ currentOrganizationId: organizationId })
      .where(eq(users.id, session.user.id));

    // Revalidate to refresh session data
    revalidatePath('/');
    
    return {
      success: true,
      data: { organizationId },
    };
  } catch (error) {
    console.error("Error switching organization:", error);
    return {
      success: false,
      error: "Failed to switch organization",
    };
  }
}

export async function joinOrganization(organizationId: number, role: string = 'member'): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return {
        success: false,
        error: "You are already a member of this organization",
      };
    }

    // Verify the organization exists
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org.length) {
      return {
        success: false,
        error: "Organization not found",
      };
    }

    // Add user to organization
    const [newMembership] = await db
      .insert(userOrganizations)
      .values({
        userId: session.user.id,
        organizationId,
        role,
      })
      .returning();

    // If user doesn't have a current organization, set this as current
    if (!session.user.currentOrganizationId) {
      await db
        .update(users)
        .set({ currentOrganizationId: organizationId })
        .where(eq(users.id, session.user.id));
    }

    revalidatePath('/');
    
    return {
      success: true,
      data: newMembership,
    };
  } catch (error) {
    console.error("Error joining organization:", error);
    return {
      success: false,
      error: "Failed to join organization",
    };
  }
}

export async function leaveOrganization(organizationId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Check if user is a member
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership.length) {
      return {
        success: false,
        error: "You are not a member of this organization",
      };
    }

    // Don't allow leaving if user is the only owner
    if (membership[0].role === 'owner') {
      const ownerCount = await db
        .select()
        .from(userOrganizations)
        .where(
          and(
            eq(userOrganizations.organizationId, organizationId),
            eq(userOrganizations.role, 'owner')
          )
        );

      if (ownerCount.length === 1) {
        return {
          success: false,
          error: "Cannot leave organization as the only owner. Transfer ownership first.",
        };
      }
    }

    // Remove membership
    await db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      );

    // If this was the user's current organization, switch to another one
    if (session.user.currentOrganizationId === organizationId) {
      const remainingMemberships = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, session.user.id))
        .limit(1);

      const newCurrentOrgId = remainingMemberships.length > 0 ? remainingMemberships[0].organizationId : null;
      
      await db
        .update(users)
        .set({ currentOrganizationId: newCurrentOrgId })
        .where(eq(users.id, session.user.id));
    }

    revalidatePath('/');
    
    return {
      success: true,
      data: { message: "Left organization successfully" },
    };
  } catch (error) {
    console.error("Error leaving organization:", error);
    return {
      success: false,
      error: "Failed to leave organization",
    };
  }
}

export async function getUserOrganizations() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Not authenticated");
    }

    const userOrgs = await db
      .select({
        organization: organizations,
        userOrg: userOrganizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, session.user.id));

    return userOrgs.map(uo => ({
      ...uo.organization,
      userRole: uo.userOrg.role,
      joinedAt: uo.userOrg.createdAt
    }));
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    throw new Error("Failed to fetch organizations");
  }
}

export async function getCurrentOrganization() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.currentOrganizationId) {
      return null;
    }

    const result = await db
      .select({
        organization: organizations,
        userOrg: userOrganizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, session.user.currentOrganizationId)
        )
      )
      .limit(1);

    if (!result.length) return null;

    return {
      ...result[0].organization,
      userRole: result[0].userOrg.role
    };
  } catch (error) {
    console.error("Error fetching current organization:", error);
    return null;
  }
}

// AIDEV-NOTE: Helper function to check if user has access to current organization context
export async function requireCurrentOrganization() {
  const org = await getCurrentOrganization();
  if (!org) {
    throw new Error("No current organization selected");
  }
  return org;
}