import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '../entities/organization';

export interface IOrganizationRepository {
  /**
   * Find organization by ID
   */
  findById(id: number): Promise<Organization | null>;

  /**
   * Find all organizations a user is a member of
   */
  findByUserId(userId: string): Promise<Organization[]>;

  /**
   * Find organization with member information
   */
  findByIdWithMembers(id: number): Promise<OrganizationWithMembers | null>;

  /**
   * Get all members of an organization
   */
  getMembers(organizationId: number): Promise<OrganizationMember[]>;

  /**
   * Create a new organization
   */
  create(data: CreateOrganizationData): Promise<Organization>;

  /**
   * Create organization with owner and default roles
   * This is a common business operation that should be atomic
   */
  createWithOwner(data: CreateOrganizationData, ownerId: string): Promise<Organization>;

  /**
   * Update organization
   */
  update(id: number, data: UpdateOrganizationData): Promise<Organization>;

  /**
   * Delete organization (and cascade related data)
   */
  delete(id: number): Promise<void>;

  /**
   * Add a member to organization
   */
  addMember(organizationId: number, userId: string, role?: string): Promise<void>;

  /**
   * Remove a member from organization
   */
  removeMember(organizationId: number, userId: string): Promise<void>;

  /**
   * Update member role in organization
   */
  updateMemberRole(organizationId: number, userId: string, role: string): Promise<void>;

  /**
   * Check if user is member of organization
   */
  isMember(organizationId: number, userId: string): Promise<boolean>;

  /**
   * Get user's role in organization
   */
  getUserRole(organizationId: number, userId: string): Promise<string | null>;

  /**
   * Find organizations by name (for search/autocomplete)
   */
  findByName(name: string, limit?: number): Promise<Organization[]>;
}