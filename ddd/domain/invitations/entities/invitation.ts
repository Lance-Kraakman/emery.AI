// AIDEV-NOTE: Invitation domain entities - manages user invitation workflow
// Supports token-based invitations with expiration and role assignment

import { 
  OrganizationId, 
  UserId, 
  EmailAddress, 
  InvitationToken, 
  OrganizationRole,
  InvitationId
} from '@/ddd/domain/shared/value-objects';

export class Invitation {
  private constructor(
    private readonly _id: InvitationId,
    private readonly _organizationId: OrganizationId,
    private readonly _invitedBy: UserId,     // UUID reference to users.id
    private _email: EmailAddress,
    private _role: OrganizationRole,         // owner, admin, member
    private readonly _token: InvitationToken,  // Unique invitation token
    private _expiresAt: Date,
    private readonly _createdAt: Date | null
  ) {}

  // Getters
  get id(): InvitationId { return this._id; }
  get organizationId(): OrganizationId { return this._organizationId; }
  get invitedBy(): UserId { return this._invitedBy; }
  get email(): EmailAddress { return this._email; }
  get role(): OrganizationRole { return this._role; }
  get token(): InvitationToken { return this._token; }
  get expiresAt(): Date { return new Date(this._expiresAt); }
  get createdAt(): Date | null { return this._createdAt ? new Date(this._createdAt) : null; }

  // Business methods
  updateEmail(newEmail: EmailAddress): void {
    this._email = newEmail;
  }

  updateRole(newRole: OrganizationRole): void {
    this._role = newRole;
  }

  updateExpirationDate(newExpiresAt: Date): void {
    if (newExpiresAt <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }
    const maxDays = MAX_INVITATION_EXPIRY_DAYS;
    const maxExpiryDate = new Date();
    maxExpiryDate.setDate(maxExpiryDate.getDate() + maxDays);
    
    if (newExpiresAt > maxExpiryDate) {
      throw new Error(`Expiration date cannot be more than ${maxDays} days from now`);
    }
    
    this._expiresAt = newExpiresAt;
  }

  isExpired(): boolean {
    return InvitationToken.isExpired(this._expiresAt);
  }

  canBeAccepted(): boolean {
    return !this.isExpired();
  }

  validateToken(providedToken: string): boolean {
    return this._token.equals(InvitationToken.fromString(providedToken));
  }

  getDaysUntilExpiry(): number {
    const now = new Date();
    const timeDiff = this._expiresAt.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  canBeModified(): boolean {
    return !this.isExpired();
  }

  // Factory methods - entity only created from persistence with real ID

  static fromPersistence(data: {
    id: number;
    organizationId: number;
    invitedBy: string;
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    createdAt?: Date | null;
  }): Invitation {
    return new Invitation(
      InvitationId.fromNumber(data.id),
      OrganizationId.fromNumber(data.organizationId),
      UserId.fromString(data.invitedBy),
      EmailAddress.fromString(data.email),
      OrganizationRole.fromString(data.role),
      InvitationToken.fromString(data.token),
      data.expiresAt,
      data.createdAt || null
    );
  }

  // Conversion method for persistence
  toPersistence(): {
    id: number;
    organizationId: number;
    invitedBy: string;
    email: string;
    role: string;
    token: string;
    expiresAt: Date;
    createdAt: Date | null;
  } {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      invitedBy: this._invitedBy.value,
      email: this._email.value,
      role: this._role.value,
      token: this._token.value,
      expiresAt: this._expiresAt,
      createdAt: this._createdAt
    };
  }
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
  organizationId: OrganizationId;
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
  organizationId?: OrganizationId;
  invitedBy?: UserId;
  email?: EmailAddress;
  role?: OrganizationRole;
  isExpired?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Bulk invitation operations
export interface BulkInvitationData {
  organizationId: OrganizationId;
  invitedBy: UserId;
  invitations: Array<{
    email: EmailAddress;
    role?: OrganizationRole;
  }>;
  defaultRole?: OrganizationRole;          // Default role for invitations without specific role
  expiresAt?: Date;
}

export interface BulkInvitationResult {
  successful: Invitation[];
  failed: Array<{
    email: EmailAddress;
    error: string;
  }>;
  totalSent: number;
  totalFailed: number;
  warnings?: string[];
}

// Invitation token utilities
export interface InvitationTokenData {
  invitationId: InvitationId;
  organizationId: OrganizationId;
  email: EmailAddress;
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