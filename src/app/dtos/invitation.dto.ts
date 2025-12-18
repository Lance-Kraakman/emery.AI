/**
 * Invitation DTOs - Single source of truth for invitation data transfer
 * Used by: Server Actions, Application Services, Client Components
 *
 * AIDEV-NOTE: DTOs for invitation system replacing direct domain entity usage
 * Following the pattern established in agent.dto.ts and team.dto.ts
 */

/**
 * DTO for sending a new invitation
 */
export interface SendInvitationDTO {
  email: string;
  roleIds: number[];
  organizationId: number;
  invitedBy: string;
  expiryDays?: number;
  sendEmail?: boolean;
}

/**
 * Full invitation DTO returned from queries
 */
export interface InvitationDTO {
  id: number;
  organizationId: number;
  invitedBy: string;
  email: string;
  roleIds: number[];
  token: string;
  expiresAt: Date;
  createdAt: Date | null;
  isExpired?: boolean;
  daysUntilExpiry?: number;
}

/**
 * DTO for invitation acceptance
 */
export interface AcceptInvitationDTO {
  token: string;
  acceptingUserEmail: string;
  userData?: {
    name?: string;
  };
}

/**
 * Invitation statistics DTO
 */
export interface InvitationStatsDTO {
  organizationId: number;
  totalInvitations: number;
  pendingInvitations: number;
  expiredInvitations: number;
  acceptedInvitations: number;
  invitationsByRole: {
    owner: number;
    admin: number;
    member: number;
  };
}
