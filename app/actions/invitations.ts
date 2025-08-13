"use server";

import { db } from "@/lib/db/client";
import { invitations, userOrganizations, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { sendInvitationEmail } from "@/lib/email";

// This would typically be in a more central place
async function requireCurrentOrganization() {
  const session = await auth();
  if (!session?.user?.currentOrganizationId) {
    throw new Error("No active organization selected");
  }
  return { id: session.user.currentOrganizationId, userId: session.user.id };
}

export async function inviteUser(formData: FormData) {
  const { id: organizationId, userId: invitedBy } = await requireCurrentOrganization();
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;

  if (!email || !role) {
    return { error: "Email and role are required" };
  }

  // TODO: Add more robust validation and permission checks here
  // For now, we'll assume the user has permission to invite.

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  await db.insert(invitations).values({
    organizationId,
    invitedBy,
    email,
    role,
    token,
    expiresAt,
  });

  // In a real app, you'd email the invitation link:
  const invitationLink = `${process.env.NEXT_PUBLIC_URL}/invitations/${token}`;
  await sendInvitationEmail(email, invitationLink);
  console.log(`Invitation link for ${email}: /invitations/${token}`);

  revalidatePath("/organization/settings/users");
  return { success: true };
}

export async function acceptInvitation(token: string) {
  const session = await auth();
  if (!session?.user) {
    // If user is not logged in, we can't proceed.
    // The UI should handle redirecting to login/signup.
    return { error: "You must be logged in to accept an invitation." };
  }

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invitation || invitation.expiresAt < new Date()) {
    return { error: "Invalid or expired invitation token." };
  }

  // Check if user is already in the organization
  const existingMembership = await db.query.userOrganizations.findFirst({
    where: and(
      eq(userOrganizations.userId, session.user.id),
      eq(userOrganizations.organizationId, invitation.organizationId)
    ),
  });

  if (existingMembership) {
    // User is already a member, so we can just delete the invitation
    await db.delete(invitations).where(eq(invitations.id, invitation.id));
    return { success: true, message: "You are already a member of this organization." };
  }

  // Add user to the organization
  await db.insert(userOrganizations).values({
    userId: session.user.id,
    organizationId: invitation.organizationId,
    role: invitation.role,
  });

  // Set the user's current organization to the one they just joined
  await db.update(users)
    .set({ currentOrganizationId: invitation.organizationId })
    .where(eq(users.id, session.user.id));

  // Delete the invitation so it can't be used again
  await db.delete(invitations).where(eq(invitations.id, invitation.id));

  revalidatePath("/organization/settings/users");
  return { success: true };
}

export async function getOrganizationMembers() {
  const { id: organizationId } = await requireCurrentOrganization();
  
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: userOrganizations.role,
    })
    .from(userOrganizations)
    .leftJoin(users, eq(userOrganizations.userId, users.id))
    .where(eq(userOrganizations.organizationId, organizationId));

  return members;
}

export async function getPendingInvitations() {
    const { id: organizationId } = await requireCurrentOrganization();

    const pending = await db.query.invitations.findMany({
        where: eq(invitations.organizationId, organizationId),
    });

    return pending;
}
