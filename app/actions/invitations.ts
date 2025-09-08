"use server";

// AIDEV-NOTE: Server Actions for invitation management using InvitationApplicationService
// Migrated from direct DB access to proper DDD application service pattern

import { revalidatePath } from "next/cache";
import { requirePermission } from "./permissions";
import { requireCurrentOrganization } from "./user-organizations";
import { getInvitationApplicationService, getUserRoleApplicationService } from "@/ddd/application/di/container";
import { withAuthContext } from '@/lib/auth/with-context';
import type { Result } from "./types";
import type { SendInvitationCommand, AcceptInvitationCommand } from "@/ddd/application/services/invitations/invitation-application-service";
import { EmailAddress, OrganizationId, UserId } from "@/ddd/domain/shared/value-objects";
import { SystemRoleType, SYSTEM_ROLES } from "@/ddd/domain/rbac/entities/role";

export async function inviteUser(formData: FormData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
    const currentOrg = await requireCurrentOrganization();
    const email = formData.get("email") as string;
    const systemRole = formData.get("systemRole") as string;

    if (!email || !systemRole) {
      return {
        success: false,
        error: "Email and system role are required"
      };
    }

    const invitationApplicationService = getInvitationApplicationService();
    
    const command: SendInvitationCommand = {
      organizationId: currentOrg.id.value,
      invitedBy: session.user.id,
      email,
      systemRole: systemRole as SystemRoleType,
      expiryDays: 7, // Default to 7 days
      sendEmail: true
    };

    const result = await invitationApplicationService.sendInvitation(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to send invitation"
      };
    }

    revalidatePath("/organization/settings/users");
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
    } catch (error) {
      console.error("Error sending invitation:", error);
      return {
        success: false,
        error: "Failed to send invitation"
      };
    }
  });
}

export async function acceptInvitation(token: string): Promise<Result> {
  try {
    const session = await requirePermission("users:invite");
    
    if (!token) {
      return {
        success: false,
        error: "Invitation token is required"
      };
    }

    const invitationApplicationService = getInvitationApplicationService();
    
    const command: AcceptInvitationCommand = {
      token,
      acceptingUserEmail: session.user.email || '',
      userData: {
        name: session.user.name || undefined
      }
    };

    const result = await invitationApplicationService.acceptInvitation(command);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to accept invitation"
      };
    }

    revalidatePath("/organization/settings/users");
    revalidatePath("/dashboard"); // User may now have access to new organization
    
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return {
      success: false,
      error: "Failed to accept invitation"
    };
  }
}

// AIDEV-NOTE: This functionality is now handled by the OrganizationRepository
// through the getMembers method. Consider moving this to organization actions.
export async function getOrganizationMembers(): Promise<Array<{id: string, name: string, email: string, systemRole: SystemRoleType}>> {
  try {
    const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();
    
    const userOrganizationApplicationService = getUserRoleApplicationService();
    const members = await userOrganizationApplicationService.getOrganizationMembers({
      organizationId: currentOrg.id.value
    });
    
    // Convert domain objects to DTOs for UI
    return members.map(member => ({
      id: member.userId.value,
      name: member.name || 'Unknown User',
      email: member.email?.value || '',
      systemRole: member.systemRole
    }));
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return [];
  }
}

export async function getPendingInvitations(): Promise<Array<{id: number, email: string, systemRole: SystemRoleType, expiresAt?: Date}>> {
  try {
    const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();
    
    const invitationApplicationService = getInvitationApplicationService();
    const invitations = await invitationApplicationService.getPendingInvitations(currentOrg.id.value);
    
    // Convert domain objects to DTOs for UI
    return invitations.map(invitation => ({
      id: invitation.id.value,
      email: invitation.email.value,
      systemRole: invitation.systemRole,
      expiresAt: invitation.expiresAt
    }));
  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    throw new Error("Failed to fetch pending invitations");
  }
}

/**
 * Revoke an existing invitation
 */
export async function revokeInvitation(invitationId: number): Promise<Result> {
  try {
    const session = await requirePermission("users:manage");
    
    if (!invitationId) {
      return {
        success: false,
        error: "Invitation ID is required"
      };
    }

    const invitationApplicationService = getInvitationApplicationService();
    const result = await invitationApplicationService.revokeInvitation(invitationId, session.user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to revoke invitation"
      };
    }

    revalidatePath("/organization/settings/users");
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return {
      success: false,
      error: "Failed to revoke invitation"
    };
  }
}

/**
 * Resend an existing invitation
 */
export async function resendInvitation(invitationId: number): Promise<Result> {
  try {
    const session = await requirePermission("users:manage");
    
    if (!invitationId) {
      return {
        success: false,
        error: "Invitation ID is required"
      };
    }

    const invitationApplicationService = getInvitationApplicationService();
    const result = await invitationApplicationService.resendInvitation(invitationId, session.user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to resend invitation"
      };
    }

    revalidatePath("/organization/settings/users");
    return {
      success: true,
      data: result.data,
      warnings: result.warnings
    };
  } catch (error) {
    console.error("Error resending invitation:", error);
    return {
      success: false,
      error: "Failed to resend invitation"
    };
  }
}

/**
 * Get invitation statistics for the current organization
 */
export async function getInvitationStats() {
  try {
    const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();
    
    const invitationApplicationService = getInvitationApplicationService();
    return await invitationApplicationService.getInvitationStats(currentOrg.id.value);
  } catch (error) {
    console.error("Error fetching invitation stats:", error);
    throw new Error("Failed to fetch invitation stats");
  }
}

/**
 * Clean up expired invitations for the current organization
 */
export async function cleanupExpiredInvitations(): Promise<Result> {
  try {
    const session = await requirePermission("users:manage");
    const currentOrg = await requireCurrentOrganization();
    
    const invitationApplicationService = getInvitationApplicationService();
    const result = await invitationApplicationService.cleanupExpiredInvitations(currentOrg.id.value);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to cleanup expired invitations"
      };
    }

    revalidatePath("/organization/settings/users");
    return {
      success: true,
      data: { cleanedCount: result.data }
    };
  } catch (error) {
    console.error("Error cleaning up expired invitations:", error);
    return {
      success: false,
      error: "Failed to cleanup expired invitations"
    };
  }
}

/**
 * Get invitation details by token (for preview pages)
 */
export async function getInvitationByToken(token: string) {
  try {
    if (!token) {
      throw new Error("Invitation token is required");
    }

    const invitationApplicationService = getInvitationApplicationService();
    const result = await invitationApplicationService.getInvitationByToken(token);

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch invitation");
    }

    return result.data;
  } catch (error) {
    console.error("Error fetching invitation by token:", error);
    throw new Error("Failed to fetch invitation");
  }
}
