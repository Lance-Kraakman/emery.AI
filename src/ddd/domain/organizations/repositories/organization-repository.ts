import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '../entities/organization';
import { OrganizationId, UserId, EmailAddress } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType } from '@/ddd/domain/rbac/entities/role';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { Invitation } from '@/ddd/domain/invitations/entities/invitation';
import type { User, UserOrganization } from '@/ddd/domain/users/entities/user';
// NOTE: API key authentication moved to token-service.ts (unified token system)

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
   * Find all organizations (admin/system use only)
   * WARNING: Returns all organizations. Use with caution in production.
   * Intended for background jobs, admin tools, and system operations.
   * Note: Requires RLS context to be set.
   */
  findAll(): Promise<Organization[]>;

  /**
   * Find all organizations bypassing RLS (system scheduler use only)
   * WARNING: Completely bypasses row-level security.
   * ONLY use for cross-org batch operations in trusted system processes.
   * Requires rawDb to be configured in repository constructor.
   */
  findAllRaw(): Promise<Organization[]>;

  /**
   * Find agent by webhook token (cross-org authentication query)
   * Used during webhook authentication before user context is established.
   * Bypasses RLS because this is how we establish the user context.
   * Requires rawDb to be configured in repository constructor.
   */
  findAgentByWebhookToken(token: string): Promise<Agent | null>;

  /**
   * Find all agents bypassing RLS (system scheduler use only)
   * WARNING: Completely bypasses row-level security.
   * ONLY use for cross-org batch operations in trusted system processes.
   * Requires rawDb to be configured in repository constructor.
   */
  findAllAgentsRaw(): Promise<Agent[]>;

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
   * Update organization bypassing RLS (bootstrap use only)
   * Used during organization creation before user has RLS context.
   * WARNING: Only use for trusted bootstrap operations like setting stripeCustomerId.
   * Requires rawDb to be configured in repository constructor.
   */
  updateRaw(id: OrganizationId, data: UpdateOrganizationData): Promise<Organization>;

  /**
   * Delete organization (and cascade related data)
   */
  delete(id: OrganizationId): Promise<void>;

  /**
   * Add a member to organization
   */
  addMember(organizationId: OrganizationId, userId: UserId, systemRole?: SystemRoleType): Promise<void>;

  /**
   * Remove a member from organization
   */
  removeMember(organizationId: OrganizationId, userId: UserId): Promise<void>;

  /**
   * Update member role in organization
   */
  updateMemberRole(organizationId: OrganizationId, userId: UserId, systemRole: SystemRoleType): Promise<void>;

  /**
   * Check if user is member of organization
   */
  isMember(organizationId: OrganizationId, userId: UserId): Promise<boolean>;

  /**
   * Get user's role in organization
   */
  getUserRole(organizationId: OrganizationId, userId: UserId): Promise<SystemRoleType | null>;

  /**
   * Find organizations by name (for search/autocomplete)
   */
  findByName(name: string, limit?: number): Promise<Organization[]>;

  /**
   * Check if an organization with the given slug exists
   * Used for slug uniqueness validation before creation
   */
  existsBySlug(slug: string): Promise<boolean>;

  /**
   * Find organization by slug
   * Used for public app routing
   */
  findBySlug(slug: string): Promise<Organization | null>;

  // =============================================================================
  // Bootstrap Operations (rawDb - bypass RLS for token-based auth)
  // These operations use rawDb because the token itself is the authentication.
  // Used during invitation acceptance before user has RLS context.
  // =============================================================================

  /**
   * Find invitation by token bypassing RLS (token-based auth)
   * Used during invitation acceptance before user has RLS context.
   * The token itself authenticates the request.
   * Requires rawDb to be configured in repository constructor.
   */
  findInvitationByTokenRaw(token: string): Promise<Invitation | null>;

  /**
   * Validate invitation token bypassing RLS
   * Returns validation result with invitation if valid.
   * Requires rawDb to be configured in repository constructor.
   */
  validateInvitationTokenRaw(token: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }>;

  /**
   * Delete/accept invitation bypassing RLS (token-based auth)
   * Removes the invitation after acceptance.
   * Requires rawDb to be configured in repository constructor.
   */
  deleteInvitationRaw(invitationId: number): Promise<void>;

  /**
   * Find user by email bypassing RLS (bootstrap use)
   * Used to check if user exists during invitation acceptance.
   * Requires rawDb to be configured in repository constructor.
   */
  findUserByEmailRaw(email: EmailAddress): Promise<User | null>;

  /**
   * Create user bypassing RLS (bootstrap use)
   * Used when a new user accepts an invitation.
   * Requires rawDb to be configured in repository constructor.
   */
  createUserRaw(data: { email: EmailAddress; name?: string; emailVerified?: Date }): Promise<User>;

  /**
   * Add user to organization bypassing RLS (bootstrap use)
   * Used during invitation acceptance to create membership.
   * Requires rawDb to be configured in repository constructor.
   */
  addUserToOrganizationRaw(userId: UserId, organizationId: OrganizationId): Promise<UserOrganization>;

  /**
   * Set user's current organization bypassing RLS (bootstrap use)
   * Used after invitation acceptance to switch user to new org.
   * Requires rawDb to be configured in repository constructor.
   */
  setUserCurrentOrganizationRaw(userId: UserId, organizationId: OrganizationId): Promise<void>;
}