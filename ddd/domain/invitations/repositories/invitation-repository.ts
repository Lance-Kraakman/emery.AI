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

export interface IInvitationRepository {
  // Basic CRUD operations
  findById(id: number): Promise<Invitation | null>;
  findByToken(token: string): Promise<Invitation | null>;
  findByEmail(organizationId: number, email: string): Promise<Invitation | null>;
  create(data: CreateInvitationData): Promise<Invitation>;
  update(id: number, data: UpdateInvitationData): Promise<Invitation>;
  delete(id: number): Promise<void>;
  
  // Query operations
  findByOrganization(organizationId: number): Promise<Invitation[]>;
  findByInviter(invitedBy: string): Promise<Invitation[]>;
  findByQuery(query: InvitationQuery): Promise<Invitation[]>;
  
  // Token and validation operations
  validateToken(token: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }>;
  isTokenExpired(token: string): Promise<boolean>;
  generateUniqueToken(): Promise<string>;
  
  // Invitation management
  acceptInvitation(token: string, acceptingUserId: string): Promise<void>;
  resendInvitation(id: number): Promise<Invitation>;
  revokeInvitation(id: number): Promise<void>;
  
  // Bulk operations
  createBulkInvitations(data: BulkInvitationData): Promise<BulkInvitationResult>;
  deleteExpiredInvitations(organizationId?: number): Promise<number>;
  deleteInvitationsByEmail(organizationId: number, email: string): Promise<number>;
  
  // Statistics and analytics
  getInvitationStats(organizationId: number): Promise<InvitationStats>;
  getPendingInvitations(organizationId: number): Promise<Invitation[]>;
  getExpiredInvitations(organizationId: number): Promise<Invitation[]>;
  
  // Business logic validations
  canInviteToOrganization(inviterId: string, organizationId: number): Promise<boolean>;
  hasExistingInvitation(organizationId: number, email: string): Promise<boolean>;
  isUserAlreadyMember(organizationId: number, email: string): Promise<boolean>;
  
  // Email and notification support
  getInvitationEmailData(id: number): Promise<{
    invitation: Invitation;
    organization: { name: string; id: number };
    inviter: { name?: string; email?: string };
  } | null>;
}