import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '../entities/organization';
import { OrganizationId, UserId, OrganizationRole } from '@/ddd/domain/shared/value-objects';

export interface IOrganizationRepository {
  /**
   * Find organization by ID
   */
  findById(id: OrganizationId): Promise<Organization | null>;

  /**
   * Find all organizations a user is a member of
   */
  findByUserId(userId: UserId): Promise<Organization[]>;

  /**
   * Find organization with member information
   */
  findByIdWithMembers(id: OrganizationId): Promise<OrganizationWithMembers | null>;

  /**
   * Get all members of an organization
   */
  getMembers(organizationId: OrganizationId): Promise<OrganizationMember[]>;

  /**
   * Create a new organization
   */
  create(data: CreateOrganizationData): Promise<Organization>;

  /**
   * Create organization with owner and default roles
   * This is a common business operation that should be atomic
   */
  createWithOwner(data: CreateOrganizationData, ownerId: UserId): Promise<Organization>;

  /**
   * Update organization
   */
  update(id: OrganizationId, data: UpdateOrganizationData): Promise<Organization>;

  /**
   * Delete organization (and cascade related data)
   */
  delete(id: OrganizationId): Promise<void>;

  /**
   * Add a member to organization
   */
  addMember(organizationId: OrganizationId, userId: UserId, role?: OrganizationRole): Promise<void>;

  /**
   * Remove a member from organization
   */
  removeMember(organizationId: OrganizationId, userId: UserId): Promise<void>;

  /**
   * Update member role in organization
   */
  updateMemberRole(organizationId: OrganizationId, userId: UserId, role: OrganizationRole): Promise<void>;

  /**
   * Check if user is member of organization
   */
  isMember(organizationId: OrganizationId, userId: UserId): Promise<boolean>;

  /**
   * Get user's role in organization
   */
  getUserRole(organizationId: OrganizationId, userId: UserId): Promise<OrganizationRole | null>;

  /**
   * Find organizations by name (for search/autocomplete)
   */
  findByName(name: string, limit?: number): Promise<Organization[]>;
}