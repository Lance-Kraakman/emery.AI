// AIDEV-NOTE: Invitation repository interface - defines business operations for invitation management
// Supports token-based invitation workflow with expiration, validation, and acceptance

import type { 
  Invitation, 
  CreateInvitationData, 
  UpdateInvitationData,
  InvitationQuery,
  BulkInvitationData,
  BulkInvitationResult,
  InvitationStats
} from '../entities/invitation';
import { InvitationId, OrganizationId, UserId, EmailAddress, InvitationToken } from '@/src/ddd/domain/shared/value-objects';

export interface IInvitationRepository {
  // Basic CRUD operations
  findById(id: InvitationId): Promise<Invitation | null>;
  findByToken(token: InvitationToken): Promise<Invitation | null>;
  findByEmail(organizationId: OrganizationId, email: EmailAddress): Promise<Invitation | null>;
  create(data: CreateInvitationData): Promise<Invitation>;
  update(id: InvitationId, data: UpdateInvitationData): Promise<Invitation>;
  delete(id: InvitationId): Promise<void>;
  
  // Query operations
  findByOrganization(organizationId: OrganizationId): Promise<Invitation[]>;
  findByQuery(query: InvitationQuery): Promise<Invitation[]>;
  
  // Token and validation operations
  validateToken(token: InvitationToken): Promise<{ valid: boolean; invitation?: Invitation; error?: string }>;
  generateUniqueToken(): Promise<InvitationToken>;
  
  // Invitation management
  acceptInvitation(token: InvitationToken, acceptingUserId: UserId): Promise<void>;
  
  // Bulk operations
  createBulkInvitations(data: BulkInvitationData): Promise<BulkInvitationResult>;
  deleteExpiredInvitations(organizationId?: OrganizationId): Promise<number>;
  deleteInvitationsByEmail(organizationId: OrganizationId, email: EmailAddress): Promise<number>;
  
  // Statistics and analytics
  getInvitationStats(organizationId: OrganizationId): Promise<InvitationStats>;
  getPendingInvitations(organizationId: OrganizationId): Promise<Invitation[]>;
  
  // Business logic validations
  canInviteToOrganization(inviterId: UserId, organizationId: OrganizationId): Promise<boolean>;
  hasExistingInvitation(organizationId: OrganizationId, email: EmailAddress): Promise<boolean>;
  isUserAlreadyMember(organizationId: OrganizationId, email: EmailAddress): Promise<boolean>;
  
  // Email and notification support
  getInvitationEmailData(id: InvitationId): Promise<{
    invitation: Invitation;
    organization: { name: string; id: OrganizationId };
    inviter: { name?: string; email?: EmailAddress };
  } | null>;
}