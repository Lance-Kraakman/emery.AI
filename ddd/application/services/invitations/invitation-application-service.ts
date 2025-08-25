/**
 * Invitation Application Service
 * 
 * Orchestrates user invitation operations including sending, accepting, and managing invitations.
 * Handles business logic for invitation workflow, validation, and email notifications.
 */

import type { IInvitationRepository } from '@/ddd/domain/invitations/repositories/invitation-repository';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { OrganizationId, UserId, EmailAddress, OrganizationRole } from '@/ddd/domain/shared/value-objects';
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

export interface SendInvitationCommand {
  organizationId: number;
  invitedBy: string;
  email: string;
  role?: string; // defaults to 'member'
  expiryDays?: number; // defaults to 7 days
  sendEmail?: boolean; // defaults to true
}

export interface BulkInvitationCommand {
  organizationId: number;
  invitedBy: string;
  invitations: Array<{
    email: string;
    role?: string;
  }>;
  defaultRole?: string;
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
    private readonly organizationRepository: IOrganizationRepository
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

      const canInvite = await this.invitationRepository.canInviteToOrganization(command.invitedBy, command.organizationId);
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

      // Validate role
      const role = command.role || 'member';
      if (!isValidInvitationRole(role)) {
        return {
          success: false,
          error: `Invalid role: ${role}. Valid roles are: owner, admin, member`
        };
      }

      // Check if user is already a member
      const isAlreadyMember = await this.invitationRepository.isUserAlreadyMember(command.organizationId, command.email);
      if (isAlreadyMember) {
        return {
          success: false,
          error: "User is already a member of this organization"
        };
      }

      // Check for existing pending invitation
      const existingInvitation = await this.invitationRepository.hasExistingInvitation(command.organizationId, command.email);
      if (existingInvitation) {
        return {
          success: false,
          error: "An invitation for this email already exists. Please revoke the existing invitation first."
        };
      }

      // Create invitation
      const invitationData: CreateInvitationData = {
        organizationId: OrganizationId.fromNumber(command.organizationId),
        invitedBy: UserId.fromString(command.invitedBy),
        email: EmailAddress.fromString(command.email.toLowerCase().trim()),
        role: OrganizationRole.fromString(role),
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
      const canInvite = await this.invitationRepository.canInviteToOrganization(command.invitedBy, command.organizationId);
      if (!canInvite) {
        return {
          success: false,
          error: "You don't have permission to invite users to this organization"
        };
      }

      // Prepare bulk invitation data
      const bulkData: BulkInvitationData = {
        organizationId: command.organizationId,
        invitedBy: command.invitedBy,
        invitations: command.invitations.map(inv => ({
          email: inv.email.toLowerCase().trim(),
          role: inv.role || command.defaultRole || 'member'
        })),
        defaultRole: command.defaultRole || 'member',
        expiresAt: createInvitationExpiry(command.expiryDays)
      };

      // Validate all roles
      for (const inv of bulkData.invitations) {
        if (!isValidInvitationRole(inv.role!)) {
          return {
            success: false,
            error: `Invalid role: ${inv.role} for email ${inv.email}`
          };
        }
      }

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
      const tokenValidation = await this.invitationRepository.validateToken(command.token);
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

      // Check if user is already a member of the organization
      const existingRole = await this.userRepository.getUserOrganizationRole(user.id, invitation.organizationId);
      if (existingRole) {
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

      // Add user to organization
      const membershipData: CreateUserOrganizationData = {
        userId: user.id,
        organizationId: invitation.organizationId,
        role: invitation.role
      };

      const userOrganization = await this.userRepository.addUserToOrganization(membershipData);

      // Set as current organization if user has no current organization
      if (!user.currentOrganizationId) {
        await this.userRepository.switchOrganization(user.id, invitation.organizationId);
      }

      // Accept the invitation (marks as used)
      await this.invitationRepository.acceptInvitation(command.token, user.id.value);

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
      const invitation = await this.invitationRepository.findById(invitationId);
      if (!invitation) {
        return {
          success: false,
          error: `Invitation with ID ${invitationId} not found`
        };
      }

      // Verify permissions to revoke
      const canInvite = await this.invitationRepository.canInviteToOrganization(revokedBy, invitation.organizationId.value);
      if (!canInvite && invitation.invitedBy.value !== revokedBy) {
        return {
          success: false,
          error: "You don't have permission to revoke this invitation"
        };
      }

      // Revoke invitation
      await this.invitationRepository.revokeInvitation(invitationId);

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
      const invitation = await this.invitationRepository.findById(invitationId);
      if (!invitation) {
        return {
          success: false,
          error: `Invitation with ID ${invitationId} not found`
        };
      }

      // Verify permissions to resend
      const canInvite = await this.invitationRepository.canInviteToOrganization(resentBy, invitation.organizationId.value);
      if (!canInvite && invitation.invitedBy.value !== resentBy) {
        return {
          success: false,
          error: "You don't have permission to resend this invitation"
        };
      }

      // Check if invitation is expired and extend if needed
      if (isInvitationExpired(invitation)) {
        await this.invitationRepository.update(invitationId, {
          expiresAt: createInvitationExpiry()
        });
      }

      // Resend invitation
      const updatedInvitation = await this.invitationRepository.resendInvitation(invitationId);

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
   * Get invitations with filtering
   */
  async getInvitations(filters: InvitationFilters): Promise<Invitation[]> {
    try {
      let invitations = await this.invitationRepository.findByOrganization(filters.organizationId);

      // Apply inviter filter
      if (filters.invitedBy) {
        invitations = invitations.filter(inv => inv.invitedBy.value === filters.invitedBy);
      }

      // Apply role filter
      if (filters.role) {
        invitations = invitations.filter(inv => inv.role.value === filters.role);
      }

      // Apply status filter
      if (filters.status) {
        const now = new Date();
        switch (filters.status) {
          case 'pending':
            invitations = invitations.filter(inv => inv.expiresAt > now);
            break;
          case 'expired':
            invitations = invitations.filter(inv => inv.expiresAt <= now);
            break;
          // 'all' - no additional filtering
        }
      }

      // Apply search filter
      if (filters.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        invitations = invitations.filter(inv => 
          inv.email.value.toLowerCase().includes(searchLower)
        );
      }

      // Sort by creation date (newest first)
      invitations.sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      return invitations;
    } catch (error) {
      console.error("Error fetching invitations:", error);
      throw new Error("Failed to fetch invitations");
    }
  }

  /**
   * Get invitation statistics for an organization
   */
  async getInvitationStats(organizationId: number): Promise<InvitationStats> {
    try {
      return await this.invitationRepository.getInvitationStats(organizationId);
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
      return await this.invitationRepository.getPendingInvitations(organizationId);
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
      const deletedCount = await this.invitationRepository.deleteExpiredInvitations(organizationId);

      return {
        success: true,
        data: deletedCount
      };
    } catch (error) {
      console.error("Error cleaning up expired invitations:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cleanup expired invitations"
      };
    }
  }

  /**
   * Get invitation by token (for displaying invitation details)
   */
  async getInvitationByToken(token: string): Promise<InvitationApplicationResult<Invitation>> {
    try {
      const invitation = await this.invitationRepository.findByToken(token);
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
      const emailData = await this.invitationRepository.getInvitationEmailData(invitationId);
      if (!emailData) {
        return null;
      }

      // Build full context with accept URL
      const acceptUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invitations/${emailData.invitation.token}`;

      return {
        invitation: emailData.invitation,
        organization: emailData.organization,
        inviter: emailData.inviter,
        acceptUrl
      };
    } catch (error) {
      console.error("Error getting invitation email context:", error);
      return null;
    }
  }
}