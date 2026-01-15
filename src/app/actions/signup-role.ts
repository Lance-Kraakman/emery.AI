'use server';

/**
 * Server Action for assigning default role to new sign-ups
 *
 * AIDEV-NOTE: This action is called client-side after successful authentication
 * when a new user signs up through a Sign In / Sign Up block configured with
 * a default role. Security measures:
 * 1. Verify user is authenticated
 * 2. Verify user was created recently (within last 10 minutes)
 * 3. Verify user doesn't already have roles in the organization
 * 4. Verify the role belongs to the organization
 */

import { db } from '@/ddd/infrastructure/db/client';
import { userRoles, users, roles, organizations } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export interface AssignSignUpRoleResult {
  success: boolean;
  error?: string;
}

/**
 * Assign a default role to a newly signed-up user
 *
 * @param roleId - The role ID to assign
 * @param orgSlug - The organization slug where the role should be assigned
 */
export async function assignSignUpRole(
  roleId: number,
  orgSlug: string
): Promise<AssignSignUpRoleResult> {
  try {
    // 1. Get current user from session
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = session.user.id;

    // 2. Verify user was created recently (within last 10 minutes)
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord) {
      return { success: false, error: 'User not found' };
    }

    const createdAt = userRecord.createdAt;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    if (createdAt < tenMinutesAgo) {
      // User account is older than 10 minutes - likely not a new sign-up
      // This prevents abuse where existing users could assign themselves roles
      return { success: false, error: 'Role assignment window expired' };
    }

    // 3. Get organization ID from slug
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, orgSlug),
    });

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    // 4. Verify user doesn't already have roles in this organization
    const existingRoles = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.organizationId, org.id)
        )
      )
      .limit(1);

    if (existingRoles.length > 0) {
      // User already has roles in this org - skip assignment
      // This could happen if they're an existing org member signing in again
      return { success: true }; // Silent success - role already exists
    }

    // 5. Verify the role exists and belongs to the organization (or is a system role)
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    });

    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    // Role must be either a system role or belong to this organization
    if (!role.isSystem && role.organizationId !== org.id) {
      return { success: false, error: 'Invalid role for this organization' };
    }

    // 6. Assign the role
    await db.insert(userRoles).values({
      userId,
      roleId,
      organizationId: org.id,
    });

    return { success: true };
  } catch (error) {
    console.error('[assignSignUpRole] Error:', error);
    return { success: false, error: 'Failed to assign role' };
  }
}
