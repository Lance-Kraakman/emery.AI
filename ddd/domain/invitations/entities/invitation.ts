// AIDEV-NOTE: Invitation domain entities - manages user invitation workflow
// Supports token-based invitations with expiration and role assignment

import { 
  OrganizationId, 
  UserId, 
  EmailAddress, 
  InvitationToken, 
  OrganizationRole 
} from '@/ddd/domain/shared/value-objects';

export interface Invitation {
  id: number;
  organizationId: OrganizationId;
  invitedBy: UserId;                       // UUID reference to users.id
  email: EmailAddress;
  role: OrganizationRole;                  // owner, admin, member
  token: InvitationToken;                  // Unique invitation token
  expiresAt: Date;
  createdAt?: Date | null;
}

export interface CreateInvitationData {
  organizationId: OrganizationId;
  invitedBy: UserId;
  email: EmailAddress;
  role?: OrganizationRole;                 // defaults to 'member'
  expiresAt?: Date;                        // defaults to 7 days from now
}

export interface UpdateInvitationData {
  email?: EmailAddress;
  role?: OrganizationRole;
  expiresAt?: Date;
}

// Invitation status and validation
export interface InvitationValidation {
  invitation: Invitation;
  isValid: boolean;
  isExpired: boolean;
  errors: InvitationValidationError[];
}

export interface InvitationValidationError {
  type: 'EXPIRED' | 'INVALID_TOKEN' | 'ALREADY_ACCEPTED' | 'EMAIL_MISMATCH';
  message: string;
}

// Invitation acceptance result
export interface InvitationAcceptanceResult {
  success: boolean;
  user?: any;                              // Created or existing user
  userOrganization?: any;                  // User-organization relationship
  error?: string;
  isNewUser: boolean;
}

// Invitation email context
export interface InvitationEmailContext {
  invitation: Invitation;
  organization: {
    name: string;
    id: number;
  };
  inviter: {
    name?: string;
    email?: string;
  };
  acceptUrl: string;                       // Full URL to accept invitation
}

// Invitation statistics
export interface InvitationStats {
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

// Invitation filtering and queries
export interface InvitationQuery {
  organizationId?: number;
  invitedBy?: string;
  email?: string;
  role?: string;
  isExpired?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Bulk invitation operations
export interface BulkInvitationData {
  organizationId: number;
  invitedBy: string;
  invitations: Array<{
    email: string;
    role?: string;
  }>;
  defaultRole?: string;                    // Default role for invitations without specific role
  expiresAt?: Date;
}

export interface BulkInvitationResult {
  successful: Invitation[];
  failed: Array<{
    email: string;
    error: string;
  }>;
  totalSent: number;
  totalFailed: number;
  warnings?: string[];
}

// Invitation token utilities
export interface InvitationTokenData {
  invitationId: number;
  organizationId: number;
  email: string;
  expiresAt: Date;
}

// AIDEV-NOTE: Role validation now handled by OrganizationRole Value Object
export const DEFAULT_INVITATION_EXPIRY_DAYS = 7;
export const MAX_INVITATION_EXPIRY_DAYS = 30;

// Helper functions
export const isValidInvitationRole = (role: string): boolean => {
  return OrganizationRole.isValidRole(role);
};

export const generateInvitationToken = (): InvitationToken => {
  return InvitationToken.generate();
};

export const createInvitationExpiry = (days: number = DEFAULT_INVITATION_EXPIRY_DAYS): Date => {
  return InvitationToken.generateExpirationDate(Math.min(days, MAX_INVITATION_EXPIRY_DAYS));
};

export const isInvitationExpired = (invitation: Invitation): boolean => {
  return InvitationToken.isExpired(invitation.expiresAt);
};