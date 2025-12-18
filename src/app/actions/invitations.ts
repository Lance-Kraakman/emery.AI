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
import { SystemRoleType, SYSTEM_ROLES, SYSTEM_ROLE_IDS } from "@/ddd/domain/rbac/entities/role";
import { toInvitationDTO, toInvitationDTOs } from "@/app/mappers/invitation-mapper";
import type { InvitationDTO } from "@/app/dtos/invitation.dto";
import { OrganizationMapper, OrganizationMemberDTO } from "../mappers/organization-mapper";

export async function inviteUser(formData: FormData): Promise<Result> {
  return withAuthContext(async () => {
    try {
      const session = await requirePermission("users:manage");
      const currentOrg = await requireCurrentOrganization();
      const email = formData.get("email") as string;
      // For now, use default Member role since we're migrating to multi-role
      const roleIdsStr = formData.get("roleIds") as string;
      const roleIds = roleIdsStr ? JSON.parse(roleIdsStr) as number[] : [SYSTEM_ROLE_IDS.MEMBER];

      if (!email) {
        return {
          success: false,
          error: "Email is required"
        };
      }

      const invitationApplicationService = getInvitationApplicationService();
      
      const command: SendInvitationCommand = {
        organizationId: currentOrg.id,
        invitedBy: session.user.id,
        email,
        roleIds: roleIds.length > 0 ? roleIds : [SYSTEM_ROLE_IDS.MEMBER],
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
      data: result.data ? toInvitationDTO(result.data) : undefined,
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
    if (!token) {
      return {
        success: false,
        error: "Invitation token is required"
      };
    }

    const invitationApplicationService = getInvitationApplicationService();

    // First, get the invitation to find the email (token is the authentication)
    const invitationResult = await invitationApplicationService.getInvitationByToken(token);
    if (!invitationResult.success || !invitationResult.data) {
      return {
        success: false,
        error: invitationResult.error || "Invalid or expired invitation"
      };
    }

    const invitation = invitationResult.data;

    // Try to get session if user is logged in (optional)
    const { getSessionSafe } = await import("./permissions");
    const session = await getSessionSafe();

    // Determine the accepting user's email
    // If logged in, verify email matches; if not logged in, use invitation email (token validates the request)
    let acceptingUserEmail: string;
    let userName: string | undefined;

    if (session?.user?.email) {
      // User is logged in - verify email matches
      if (session.user.email.toLowerCase() !== invitation.email.value.toLowerCase()) {
        return {
          success: false,
          error: "You must be signed in with the email address this invitation was sent to"
        };
      }
      acceptingUserEmail = session.user.email;
      userName = session.user.name || undefined;
    } else {
      // User is NOT logged in - the token authenticates the request
      // Use the email from the invitation itself
      acceptingUserEmail = invitation.email.value;
      userName = undefined;
    }

    const command: AcceptInvitationCommand = {
      token,
      acceptingUserEmail,
      userData: {
        name: userName
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
export async function getOrganizationMembers(): Promise<Array<OrganizationMemberDTO>> {
  try {
    const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();
    
    const userOrganizationApplicationService = getUserRoleApplicationService();
    const members = await userOrganizationApplicationService.getOrganizationMembers({
      organizationId: currentOrg.id
    });
    
    // Convert domain objects to DTOs for UI
    return members.map(member => (OrganizationMapper.memberToDTO(member)));
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return [];
  }
}

export async function getPendingInvitations(): Promise<InvitationDTO[]> {
  try {
    const session = await requirePermission("users:view");
    const currentOrg = await requireCurrentOrganization();

    const invitationApplicationService = getInvitationApplicationService();
    const invitations = await invitationApplicationService.getPendingInvitations(currentOrg.id);

    // Convert domain objects to DTOs for UI
    return toInvitationDTOs(invitations);
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
      data: result.data ? toInvitationDTO(result.data) : undefined,
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
    return await invitationApplicationService.getInvitationStats(currentOrg.id);
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
    const result = await invitationApplicationService.cleanupExpiredInvitations(currentOrg.id);

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

    return result.data ? toInvitationDTO(result.data) : undefined;
  } catch (error) {
    console.error("Error fetching invitation by token:", error);
    throw new Error("Failed to fetch invitation");
  }
}
