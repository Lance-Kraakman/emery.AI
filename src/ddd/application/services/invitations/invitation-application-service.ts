/**
 * Invitation Application Service
 *
 * Orchestrates user invitation operations including sending, accepting, and managing invitations.
 * Handles business logic for invitation workflow, validation, and email notifications.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';

const logger = createDebugLogger('InvitationService');
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IRBACRepository } from '@/ddd/domain/rbac/repositories/rbac-repository';
import { OrganizationId, UserId, EmailAddress, InvitationId, InvitationToken } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import type { Result } from '@/ddd/domain/shared/result';
import type {
  Invitation,
  CreateInvitationData,
  BulkInvitationData,
  BulkInvitationResult,
  InvitationStats,
  InvitationAcceptanceResult,
  InvitationEmailContext
} from '@/ddd/domain/invitations/entities/invitation';
import {
  isValidInvitationRole,
  createInvitationExpiry,
  isInvitationExpired
} from '@/ddd/domain/invitations/entities/invitation';
import type { CreateUserData, CreateUserOrganizationData } from '@/ddd/domain/users/entities/user';
import { sendInvitationEmail } from '@/lib/email';
import { getTierConfig } from '@/lib/stripe/config';

export interface SendInvitationCommand {
  organizationId: number;
  invitedBy: string;
  email: string;
  roleIds: number[]; // Array of role IDs for multi-role assignment (replaces systemRole)
  expiryDays?: number; // defaults to 7 days
  sendEmail?: boolean; // defaults to true
}

export interface BulkInvitationCommand {
  organizationId: number;
  invitedBy: string;
  invitations: Array<{
    email: EmailAddress;
    roleIds?: number[]; // Array of role IDs for multi-role assignment
  }>;
  defaultRoleIds?: number[]; // Default role IDs if not specified per invitation
  expiryDays?: number;
  sendEmail?: boolean;
}

export interface AcceptInvitationCommand {
  token: string;
  acceptingUserEmail: string;
  userData?: {
    name?: string;
    password?: string; // For new user creation
  };
}

export interface InvitationFilters {
  organizationId: number;
  invitedBy?: string;
  role?: string;
  status?: 'pending' | 'expired' | 'all';
  searchQuery?: string;
}

// Use unified Result interface from domain shared types
export type InvitationApplicationResult<T = any> = Result<T>;

export class InvitationApplicationService {
  constructor(
    private readonly invitationRepository: IInvitationRepository,
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly rbacRepository: IRBACRepository
  ) {}

  /**
   * Send an invitation to a user
   */
  async sendInvitation(command: SendInvitationCommand): Promise<InvitationApplicationResult<Invitation>> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findById(OrganizationId.fromNumber(command.organizationId));
      if (!organization) {
        return {
          success: false,
          error: `Organization with ID ${command.organizationId} not found`
        };
      }

      // Verify inviter exists and can invite to organization
      const inviter = await this.userRepository.findById(UserId.fromString(command.invitedBy));
      if (!inviter) {
        return {
          success: false,
          error: `Inviter with ID ${command.invitedBy} not found`
        };
      }

      const canInvite = await this.invitationRepository.canInviteToOrganization(UserId.fromString(command.invitedBy), OrganizationId.fromNumber(command.organizationId));
      if (!canInvite) {
        return {
          success: false,
          error: "You don't have permission to invite users to this organization"
        };
      }

// Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(command.email)) {
        return {
          success: false,
          error: "Invalid email format"
        };
      }

      // Validate role IDs
      if (!command.roleIds || command.roleIds.length === 0) {
        return {
          success: false,
          error: "At least one role ID is required"
        };
      }

      // Validate that role IDs exist and are valid for this organization (including system roles)
      const orgRoles = await this.rbacRepository.findRolesByOrganization(OrganizationId.fromNumber(command.organizationId));
      const systemRoles = await this.rbacRepository.getSystemRoles();
      const allValidRoles = [...orgRoles, ...systemRoles];
      const validRoleIds = allValidRoles.map(role => role.id);
      
      for (const roleId of command.roleIds) {
        if (!validRoleIds.includes(roleId)) {
          return {
            success: false,
            error: `Invalid role ID: ${roleId}. Role must exist in this organization.`
          };
        }
      }

      // Check if user is already a member
      const isAlreadyMember = await this.invitationRepository.isUserAlreadyMember(OrganizationId.fromNumber(command.organizationId), EmailAddress.fromString(command.email));
      if (isAlreadyMember) {
        return {
          success: false,
          error: "User is already a member of this organization"
        };
      }

      // Check for existing pending invitation
      const existingInvitation = await this.invitationRepository.hasExistingInvitation(OrganizationId.fromNumber(command.organizationId), EmailAddress.fromString(command.email));
      if (existingInvitation) {
        return {
          success: false,
          error: "An invitation for this email already exists. Please revoke the existing invitation first."
        };
      }

      // Check member limit for Free tier
      const tierConfig = getTierConfig(organization.plan || 'free');
      if (tierConfig.maxTeamMembers !== null) {
        const orgWithMembers = await this.organizationRepository.findByIdWithMembers(OrganizationId.fromNumber(command.organizationId));
        const currentMemberCount = orgWithMembers?.memberCount || 0;

        if (currentMemberCount >= tierConfig.maxTeamMembers) {
          return {
            success: false,
            error: `${tierConfig.displayName} tier is limited to ${tierConfig.maxTeamMembers} team members. Upgrade to Pro for unlimited members.`
          };
        }
      }

      // Create invitation
      const invitationData: CreateInvitationData = {
        organizationId: OrganizationId.fromNumber(command.organizationId),
        invitedBy: UserId.fromString(command.invitedBy),
        email: EmailAddress.fromString(command.email.toLowerCase().trim()),
        roleIds: command.roleIds,
        expiresAt: createInvitationExpiry(command.expiryDays)
      };

      const invitation = await this.invitationRepository.create(invitationData);

      // Send email notification if requested
      if (command.sendEmail !== false) {
        try {
          const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${invitation.token}`;
          await sendInvitationEmail(invitation.email.value, acceptUrl);
        } catch (emailError) {
          console.error("Failed to send invitation email:", emailError);
          // Still return success since invitation was created
          return {
            success: true,
            data: invitation,
            warnings: ["Invitation created but email failed to send"]
          };
        }
      }

      return {
        success: true,
        data: invitation
      };
    } catch (error) {
      console.error("Error sending invitation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send invitation"
      };
    }
  }

  /**
   * Send bulk invitations
   */
  async sendBulkInvitations(command: BulkInvitationCommand): Promise<InvitationApplicationResult<BulkInvitationResult>> {
    try {
      // Verify organization exists
      const organization = await this.organizationRepository.findById(OrganizationId.fromNumber(command.organizationId));
      if (!organization) {
        return {
          success: false,
          error: `Organization with ID ${command.organizationId} not found`
        };
      }

      // Verify inviter permissions
      const canInvite = await this.invitationRepository.canInviteToOrganization(UserId.fromString(command.invitedBy), OrganizationId.fromNumber(command.organizationId));
      if (!canInvite) {
        return {
          success: false,
          error: "You don't have permission to invite users to this organization"
        };
      }

      // Prepare bulk invitation data - VOs are already validated
const bulkData: BulkInvitationData = {
        organizationId: OrganizationId.fromNumber(command.organizationId),
        invitedBy: UserId.fromString(command.invitedBy),
        invitations: command.invitations.map(inv => ({
          email: inv.email,
          roleIds: inv.roleIds || command.defaultRoleIds || [4] // Default to Member role ID
        })),
        defaultRoleIds: command.defaultRoleIds || [4], // Default to Member role ID
        expiresAt: createInvitationExpiry(command.expiryDays)
      };

      // Send bulk invitations
      const result = await this.invitationRepository.createBulkInvitations(bulkData);

      // Send email notifications if requested
      if (command.sendEmail !== false && result.successful.length > 0) {
        const emailPromises = result.successful.map(async (invitation) => {
          try {
            const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${invitation.token}`;
            await sendInvitationEmail(invitation.email.value, acceptUrl);
            return { email: invitation.email, success: true };
          } catch (emailError) {
            console.error(`Failed to send invitation email to ${invitation.email}:`, emailError);
            return { email: invitation.email, success: false };
          }
        });

        const emailResults = await Promise.all(emailPromises);
        const failedEmails = emailResults.filter(r => !r.success).map(r => r.email);
        
        if (failedEmails.length > 0) {
          const existingWarnings = result.warnings || [];
          const emailWarnings = [`Failed to send emails to: ${failedEmails.join(', ')}`];
          result.warnings = [...existingWarnings, ...emailWarnings];
        }
      }

      return {
        success: true,
        data: result,
        warnings: result.totalFailed > 0 ? [`${result.totalFailed} invitations failed to send`] : undefined
      };
    } catch (error) {
      console.error("Error sending bulk invitations:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send bulk invitations"
      };
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(command: AcceptInvitationCommand): Promise<InvitationApplicationResult<InvitationAcceptanceResult>> {
    try {
      // Validate token and get invitation
      const tokenValidation = await this.invitationRepository.validateToken(InvitationToken.fromString(command.token));
      if (!tokenValidation.valid || !tokenValidation.invitation) {
        return {
          success: false,
          error: tokenValidation.error || "Invalid invitation token"
        };
      }

      const invitation = tokenValidation.invitation;

      // Check if invitation is expired
      if (isInvitationExpired(invitation)) {
        return {
          success: false,
          error: "This invitation has expired"
        };
      }

      // Verify email matches invitation
      if (invitation.email.value.toLowerCase() !== command.acceptingUserEmail.toLowerCase()) {
        return {
          success: false,
          error: "Email address does not match the invitation"
        };
      }

      // Check if user already exists
      let user = await this.userRepository.findByEmail(EmailAddress.fromString(command.acceptingUserEmail));
      let isNewUser = false;

      if (!user) {
        // Create new user
        const userData: CreateUserData = {
          email: EmailAddress.fromString(command.acceptingUserEmail.toLowerCase()),
          name: command.userData?.name,
          emailVerified: new Date() // Auto-verify email since they clicked the invitation link
        };

        user = await this.userRepository.create(userData);
        isNewUser = true;
      }

      // TODO: Check if user is already a member via RBAC system
      // const existingRole = await this.rbacRepository.getUserRoles(user.id, invitation.organizationId);
      // For now, skip membership check - RBAC system will handle duplicate role assignments
      if (false) {
        // User is already a member, just revoke the invitation
        await this.invitationRepository.delete(invitation.id);
        
        return {
          success: true,
          data: {
            success: true,
            user,
            error: "You are already a member of this organization",
            isNewUser
          }
        };
      }

      // Add user to organization (role assignment handled by RBAC)
      const membershipData: CreateUserOrganizationData = {
        userId: user.id,
        organizationId: invitation.organizationId
      };
      
      const userOrganization = await this.userRepository.addUserToOrganization(membershipData);

      // Assign the roles in RBAC system
      try {
        // Assign all roles from the invitation
        for (const roleId of invitation.roleIds) {
          try {
            await this.rbacRepository.assignRole(
              user.id,
              roleId,
              invitation.organizationId
            );
            console.log(`✅ Assigned role ID ${roleId} to user ${user.id.value} in org ${invitation.organizationId.value} via invitation`);
          } catch (roleAssignmentError) {
            console.error(`⚠️ Failed to assign role ID ${roleId} to user ${user.id.value}:`, roleAssignmentError);
          }
        }
      } catch (roleError) {
        console.error('Error assigning roles after accepting invitation:', roleError);
        // Don't fail the whole operation - user is already added to org
      }

      // Set as current organization if user has no current organization
      if (!user.currentOrganizationId) {
        await this.userRepository.switchOrganization(user.id, invitation.organizationId);
      }

      // Accept the invitation (marks as used)
      await this.invitationRepository.acceptInvitation(InvitationToken.fromString(command.token), user.id);

      const result: InvitationAcceptanceResult = {
        success: true,
        user,
        userOrganization,
        isNewUser
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to accept invitation"
      };
    }
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(invitationId: number, revokedBy: string): Promise<InvitationApplicationResult<void>> {
    try {
      // Verify invitation exists
      const invitation = await this.invitationRepository.findById(InvitationId.fromNumber(invitationId));
      if (!invitation) {
        return {
          success: false,
          error: `Invitation with ID ${invitationId} not found`
        };
      }

      // Verify permissions to revoke
      const canInvite = await this.invitationRepository.canInviteToOrganization(UserId.fromString(revokedBy), invitation.organizationId);
      if (!canInvite && invitation.invitedBy.value !== revokedBy) {
        return {
          success: false,
          error: "You don't have permission to revoke this invitation"
        };
      }

      // Revoke invitation (delete it)
      await this.invitationRepository.delete(InvitationId.fromNumber(invitationId));

      return {
        success: true,
        data: undefined
      };
    } catch (error) {
      console.error("Error revoking invitation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke invitation"
      };
    }
  }

  /**
   * Resend an invitation
   */
  async resendInvitation(invitationId: number, resentBy: string): Promise<InvitationApplicationResult<Invitation>> {
    try {
      // Verify invitation exists
      const invitation = await this.invitationRepository.findById(InvitationId.fromNumber(invitationId));
      if (!invitation) {
        return {
          success: false,
          error: `Invitation with ID ${invitationId} not found`
        };
      }

      // Verify permissions to resend
      const canInvite = await this.invitationRepository.canInviteToOrganization(UserId.fromString(resentBy), invitation.organizationId);
      if (!canInvite && invitation.invitedBy.value !== resentBy) {
        return {
          success: false,
          error: "You don't have permission to resend this invitation"
        };
      }

      // Check if invitation is expired and extend if needed
      if (isInvitationExpired(invitation)) {
        await this.invitationRepository.update(InvitationId.fromNumber(invitationId), {
          expiresAt: createInvitationExpiry()
        });
      }

      // Extend expiry and update invitation
      const updatedInvitation = await this.invitationRepository.update(InvitationId.fromNumber(invitationId), {
        expiresAt: createInvitationExpiry()
      });

      // Send email notification
      try {
        const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${updatedInvitation.token}`;
        await sendInvitationEmail(updatedInvitation.email.value, acceptUrl);
      } catch (emailError) {
        console.error("Failed to resend invitation email:", emailError);
        return {
          success: true,
          data: updatedInvitation,
          warnings: ["Invitation updated but email failed to send"]
        };
      }

      return {
        success: true,
        data: updatedInvitation
      };
    } catch (error) {
      console.error("Error resending invitation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to resend invitation"
      };
    }
  }


  /**
   * Get invitation statistics for an organization
   */
  async getInvitationStats(organizationId: number): Promise<InvitationStats> {
    try {
      return await this.invitationRepository.getInvitationStats(OrganizationId.fromNumber(organizationId));
    } catch (error) {
      console.error("Error getting invitation stats:", error);
      throw new Error("Failed to get invitation statistics");
    }
  }

  /**
   * Get pending invitations for an organization
   */
  async getPendingInvitations(organizationId: number): Promise<Invitation[]> {
    try {
      return await this.invitationRepository.getPendingInvitations(OrganizationId.fromNumber(organizationId));
    } catch (error) {
      console.error("Error getting pending invitations:", error);
      throw new Error("Failed to get pending invitations");
    }
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(organizationId?: number): Promise<InvitationApplicationResult<number>> {
    try {
      const deletedCount = await this.invitationRepository.deleteExpiredInvitations(organizationId ? OrganizationId.fromNumber(organizationId) : undefined);

      return {
        success: true,
        data: deletedCount
      };
    } catch (error) {
      console.error("Error cleaning up expired invitations:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cleanup expired invitations",
        data: 0
      };
    }
  }

  /**
   * Get invitation by token (for displaying invitation details)
   */
  async getInvitationByToken(token: string): Promise<InvitationApplicationResult<Invitation>> {
    try {
      const invitation = await this.invitationRepository.findByToken(InvitationToken.fromString(token));
      if (!invitation) {
        return {
          success: false,
          error: "Invitation not found"
        };
      }

      // Check if expired
      if (isInvitationExpired(invitation)) {
        return {
          success: false,
          error: "This invitation has expired"
        };
      }

      return {
        success: true,
        data: invitation
      };
    } catch (error) {
      console.error("Error getting invitation by token:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get invitation"
      };
    }
  }

  /**
   * Get invitation email context for email templates
   */
  async getInvitationEmailContext(invitationId: number): Promise<InvitationEmailContext | null> {
    try {
      const emailData = await this.invitationRepository.getInvitationEmailData(InvitationId.fromNumber(invitationId));
      if (!emailData) {
        return null;
      }

      // Build full context with accept URL
      const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${emailData.invitation.token}`;

      return {
        invitation: emailData.invitation,
        organization: {
          ...emailData.organization,
          id: emailData.organization.id.value
        },
        inviter: {
          ...emailData.inviter,
          email: emailData.inviter.email?.value
        },
        acceptUrl
      };
    } catch (error) {
      console.error("Error getting invitation email context:", error);
      return null;
    }
  }
}