import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '../entities/organization';
import { OrganizationId, UserId, OrganizationRole } from '@/ddd/domain/shared/value-objects';

// Transaction context type for RLS support  
export type TransactionContext = any; // Will be the Drizzle transaction type

export interface IOrganizationRepository {
  /**
   * Find organization by ID
   */
  findById(id: OrganizationId, tx?: TransactionContext): Promise<Organization | null>;

  /**
   * Find all organizations a user is a member of
   */
  findByUserId(userId: UserId, tx?: TransactionContext): Promise<Organization[]>;

  /**
   * Find organization with member information
   */
  findByIdWithMembers(id: OrganizationId, tx?: TransactionContext): Promise<OrganizationWithMembers | null>;

  /**
   * Get all members of an organization
   */
  getMembers(organizationId: OrganizationId, tx?: TransactionContext): Promise<OrganizationMember[]>;

  /**
   * Create a new organization
   */
  create(data: CreateOrganizationData, tx?: TransactionContext): Promise<Organization>;

  /**
   * Create organization with owner and default roles
   * This is a common business operation that should be atomic
   */
  createWithOwner(data: CreateOrganizationData, ownerId: UserId, tx?: TransactionContext): Promise<Organization>;

  /**
   * Update organization
   */
  update(id: OrganizationId, data: UpdateOrganizationData, tx?: TransactionContext): Promise<Organization>;

  /**
   * Delete organization (and cascade related data)
   */
  delete(id: OrganizationId, tx?: TransactionContext): Promise<void>;

  /**
   * Add a member to organization
   */
  addMember(organizationId: OrganizationId, userId: UserId, role?: OrganizationRole, tx?: TransactionContext): Promise<void>;

  /**
   * Remove a member from organization
   */
  removeMember(organizationId: OrganizationId, userId: UserId, tx?: TransactionContext): Promise<void>;

  /**
   * Update member role in organization
   */
  updateMemberRole(organizationId: OrganizationId, userId: UserId, role: OrganizationRole, tx?: TransactionContext): Promise<void>;

  /**
   * Check if user is member of organization
   */
  isMember(organizationId: OrganizationId, userId: UserId, tx?: TransactionContext): Promise<boolean>;

  /**
   * Get user's role in organization
   */
  getUserRole(organizationId: OrganizationId, userId: UserId, tx?: TransactionContext): Promise<OrganizationRole | null>;

  /**
   * Find organizations by name (for search/autocomplete)
   */
  findByName(name: string, limit?: number, tx?: TransactionContext): Promise<Organization[]>;
  
  /**
   * Bootstrap method - creates organization and sets up owner relationship within transaction
   */
  createWithOwnerBootstrap(data: CreateOrganizationData, ownerId: UserId, tx: TransactionContext): Promise<Organization>;
}