import { eq, ilike, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import type { DbClient } from '@/ddd/infrastructure/db/client';
import { organizations, users, userOrganizations, roles, userRoles, agents } from '@/ddd/infrastructure/db/schema';
import { OrganizationId, UserId, OrganizationName, EmailAddress } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { AgentFactory } from '@/ddd/domain/agents/entities/agent';

type OrganizationRow = InferSelectModel<typeof organizations>;

export class DrizzleOrganizationRepository
  extends DrizzleBaseRepository<Organization, OrganizationId, CreateOrganizationData, UpdateOrganizationData, OrganizationRow>
  implements IOrganizationRepository {

  protected readonly table = organizations;
  protected readonly idColumn = organizations.id;
  protected readonly organizationColumn = undefined; // Organizations are not org-scoped

  /**
   * @param db - Context-aware database client (with RLS enforcement)
   * @param rawDb - Optional raw database client for cross-org queries (bypasses RLS)
   */
  constructor(
    db: DbClient,
    private readonly rawDb?: DbClient
  ) {
    super(db);
  }

  /**
   * Generate URL-safe slug from organization name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  // findById inherited from DrizzleBaseRepository

  async findByUserId(userId: UserId): Promise<Organization[]> {
    const result = await this.db
      .select()
      .from(organizations)
      .innerJoin(userOrganizations, eq(organizations.id, userOrganizations.organizationId))
      .where(eq(userOrganizations.userId, userId.value));

    return result.map((row: { organizations: OrganizationRow }) => this.fromPersistence(row.organizations));
  }

  async findAll(): Promise<Organization[]> {
    const result = await this.db
      .select()
      .from(organizations);

    return result.map((org: OrganizationRow) => this.fromPersistence(org));
  }

  /**
   * Find all organizations bypassing RLS (system scheduler use only)
   * WARNING: Completely bypasses row-level security.
   * ONLY use for cross-org batch operations in trusted system processes.
   */
  async findAllRaw(): Promise<Organization[]> {
    if (!this.rawDb) {
      throw new Error('Raw DB required for findAllRaw(). Pass rawDb to constructor when cross-org queries are needed.');
    }
    const result = await this.rawDb
      .select()
      .from(organizations);

    return result.map((org: OrganizationRow) => this.fromPersistence(org));
  }

  /**
   * Find agent by webhook token (cross-org authentication query)
   * Used during webhook authentication before user context is established.
   * Bypasses RLS because this is how we establish the user context.
   */
  async findAgentByWebhookToken(token: string): Promise<Agent | null> {
    if (!this.rawDb) {
      throw new Error('Raw DB required for findAgentByWebhookToken(). Pass rawDb to constructor.');
    }
    try {
      const [record] = await this.rawDb
        .select()
        .from(agents)
        .where(eq(agents.webhookToken, token))
        .limit(1);

      if (!record) {
        return null;
      }

      return AgentFactory.fromPersistence(record);
    } catch (error) {
      console.error('Error finding agent by webhook token:', error);
      return null;
    }
  }

  /**
   * Find all agents bypassing RLS (system scheduler use only)
   * WARNING: Completely bypasses row-level security.
   * ONLY use for cross-org batch operations in trusted system processes.
   */
  async findAllAgentsRaw(): Promise<Agent[]> {
    if (!this.rawDb) {
      throw new Error('Raw DB required for findAllAgentsRaw(). Pass rawDb to constructor.');
    }
    const results = await this.rawDb
      .select()
      .from(agents);

    return results.map((record: any) => AgentFactory.fromPersistence(record));
  }

  async findByIdWithMembers(id: OrganizationId): Promise<OrganizationWithMembers | null> {
    const org = await this.findById(id);
    if (!org) return null;

    const members = await this.getMembers(id);
    
    return {
      ...org,
      memberCount: members.length,
      members
    };
  }

  async getMembers(organizationId: OrganizationId): Promise<OrganizationMember[]> {
    // Get basic member info
    const membersResult = await this.db
      .select({
        userId: userOrganizations.userId,
        name: users.name,
        email: users.email,
        joinedAt: userOrganizations.createdAt,
      })
      .from(userOrganizations)
      .leftJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId.value));

    // Get roles for all members in this organization
    const rolesResult = await this.db
      .select({
        userId: userRoles.userId,
        roleId: roles.id,
        roleName: roles.name,
        isSystem: roles.isSystem,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.organizationId, organizationId.value));

    // Group roles by userId
    const rolesByUser = new Map<string, Array<{id: number; name: string; isSystem: boolean}>>();
    for (const role of rolesResult) {
      const existing = rolesByUser.get(role.userId) || [];
      existing.push({
        id: role.roleId,
        name: role.roleName,
        isSystem: role.isSystem,
      });
      rolesByUser.set(role.userId, existing);
    }

    // Map to OrganizationMember with roles
    return membersResult.map((member: { userId: string; name: string | null; email: string | null; joinedAt: Date | null }) => ({
      userId: UserId.fromString(member.userId),
      name: member.name,
      email: member.email ? EmailAddress.fromString(member.email) : null,
      joinedAt: member.joinedAt,
      roles: rolesByUser.get(member.userId) || [],
    }));
  }

  async create(data: CreateOrganizationData): Promise<Organization> {
    // Convert Value Objects to database primitives and generate slug
    const dbData = {
      ...data,
      name: data.name.value, // Convert OrganizationName to string
      slug: data.slug || this.generateSlug(data.name.value) // Generate slug if not provided
    };
    
    const [result] = await this.db
      .insert(organizations)
      .values(dbData)
      .returning();

    return this.fromPersistence(result);
  }

  async createWithOwner(data: CreateOrganizationData, ownerId: UserId): Promise<Organization> {
    // Organization creation is a bootstrap operation that happens before
    // the user has an organization context. Use rawDb to bypass RLS.
    if (!this.rawDb) {
      throw new Error('Raw DB required for createWithOwner(). This is a bootstrap operation.');
    }
    return await this.rawDb.transaction(async (tx: any) => {
      return this.createWithOwnerBootstrap(data, ownerId, tx);
    });
  }
  
  // Bootstrap method that works within a transaction
  async createWithOwnerBootstrap(data: CreateOrganizationData, ownerId: UserId, tx: any): Promise<Organization> {
    // Convert Value Objects to database primitives and generate slug
    const dbData = {
      ...data,
      name: data.name.value, // Convert OrganizationName to string
      slug: data.slug || this.generateSlug(data.name.value) // Generate slug if not provided
    };

    // Pre-validate slug uniqueness to provide clear error message
    const slugExists = await this.existsBySlug(dbData.slug);
    if (slugExists) {
      throw new Error(`SLUG_TAKEN:${dbData.slug}`); // Special error format for parsing
    }

    // Create organization (with backup database constraint error handling)
    let org;
    try {
      [org] = await tx
        .insert(organizations)
        .values(dbData)
        .returning();
    } catch (error: any) {
      // Backup: Handle race condition where slug was taken between check and insert
      if (error?.code === '23505' && error?.constraint_name === 'organizations_slug_unique') {
        throw new Error(`SLUG_TAKEN:${dbData.slug}`);
      }
      throw error; // Re-throw other errors
    }

    // Add owner as organization member (no role column in new schema)
    await tx
      .insert(userOrganizations)
      .values({
        userId: ownerId.value,
        organizationId: org.id
      });

    // Update user's current organization (no organizationRole column in new schema)
    await tx
      .update(users)
      .set({ 
        currentOrganizationId: org.id
      })
      .where(eq(users.id, ownerId.value));

    // RBAC: Assign Organization Owner role
    // First, get the Organization Owner system role
    const ownerRole = await tx
      .select()
      .from(roles)
      .where(and(
        eq(roles.name, 'Organization Owner'),
        eq(roles.isSystem, true)
      ))
      .limit(1);

    if (ownerRole.length > 0) {
      // Create user_roles entry
      await tx
        .insert(userRoles)
        .values({
          userId: ownerId.value,
          roleId: ownerRole[0].id,
          organizationId: org.id,
          assignedAt: new Date()
        });
    } else {
      console.error(`⚠️ System role 'Organization Owner' not found during organization creation. Run RBAC seed first.`);
    }

    return this.fromPersistence(org);
  }

  async update(id: OrganizationId, data: UpdateOrganizationData): Promise<Organization> {
    // Convert Value Objects to database primitives
    const dbData = {
      ...data,
      name: data.name?.value // Convert OrganizationName to string if present
    };
    
    const [result] = await this.db
      .update(organizations)
      .set(dbData)
      .where(eq(organizations.id, id.value))
      .returning();

    if (!result) {
      throw new Error(`Organization with id ${id.value} not found`);
    }

    return this.fromPersistence(result);
  }

  async delete(id: OrganizationId): Promise<void> {
    await this.db.transaction(async (tx: any) => {
      // Clean up user organization memberships (should cascade)
      await tx
        .delete(userOrganizations)
        .where(eq(userOrganizations.organizationId, id.value));

      // Delete the organization (no separate roles table in simplified RBAC)
      await tx
        .delete(organizations)
        .where(eq(organizations.id, id.value));
    });
  }

  async addMember(organizationId: OrganizationId, userId: UserId, systemRole: SystemRoleType = SYSTEM_ROLES.MEMBER): Promise<void> {
    // Check if user is already a member
    const existing = await this.db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.organizationId, organizationId.value),
        eq(userOrganizations.userId, userId.value)
      )
    });

    if (existing) {
      throw new Error('User is already a member of this organization');
    }

    await this.db
      .insert(userOrganizations)
      .values({
        userId: userId.value,
        organizationId: organizationId.value,
        // Note: role column removed in RBAC system - roles now managed through user_roles table
      });
  }

  async removeMember(organizationId: OrganizationId, userId: UserId): Promise<void> {
    const result = await this.db
      .delete(userOrganizations)
      .where(and(
        eq(userOrganizations.organizationId, organizationId.value),
        eq(userOrganizations.userId, userId.value)
      ));

    // Note: You might want to check if this was the owner and prevent removal,
    // or transfer ownership first
  }

  async updateMemberRole(organizationId: OrganizationId, userId: UserId, systemRole: SystemRoleType): Promise<void> {
    // TODO: Update for RBAC system - roles are now managed through user_roles table
    // This method needs to be reimplemented to work with the permission-based system
    throw new Error('Role updates not yet implemented for RBAC system');
  }

  async isMember(organizationId: OrganizationId, userId: UserId): Promise<boolean> {
    const result = await this.db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.organizationId, organizationId.value),
        eq(userOrganizations.userId, userId.value)
      )
    });

    return !!result;
  }

  async getUserRole(organizationId: OrganizationId, userId: UserId): Promise<SystemRoleType | null> {
    throw new Error('getUserRole() not implemented for RBAC system. Use permission checking instead.');
  }

  async findByName(name: string, limit: number = 10): Promise<Organization[]> {
    try {
      const result = await this.db.query.organizations.findMany({
        where: ilike(organizations.name, `%${name}%`),
        limit
      });
      return result.map((org: OrganizationRow) => this.fromPersistence(org));
    } catch (error) {
      console.error("Failed to find organizations by name:", error);
      return [];
    }
  }

  async existsBySlug(slug: string): Promise<boolean> {
    // Slug uniqueness is global (not org-scoped), use rawDb to allow
    // checking during bootstrap (before user has an org context)
    const dbToUse = this.rawDb || this.db;
    const result = await dbToUse.query.organizations.findFirst({
      where: eq(organizations.slug, slug.toLowerCase()),
      columns: { id: true } // Only select id for performance
    });
    return !!result;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    // Looking up orgs by slug is a global operation, use rawDb
    const dbToUse = this.rawDb || this.db;
    const result = await dbToUse.query.organizations.findFirst({
      where: eq(organizations.slug, slug.toLowerCase())
    });
    return result ? this.fromPersistence(result) : null;
  }

  // AIDEV-NOTE: Boundary conversion - maps database primitives to domain Value Objects
  protected fromPersistence(data: any): Organization {
    return {
      id: new OrganizationId(data.id),
      name: new OrganizationName(data.name),
      slug: data.slug,
      mission: data.mission,
      sharedTools: data.sharedTools,
      sharedServers: data.sharedServers,
      databaseId: data.databaseId,
      viewConfig: data.viewConfig as Record<string, any> | null,
      analysisCapabilities: data.analysisCapabilities,
      plan: data.plan as Organization['plan'],
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeSubscriptionStatus: data.stripeSubscriptionStatus,
      // Billing and model configuration
      defaultModel: data.defaultModel,
      availableModels: data.availableModels,
      tokenQuotaMonthly: data.tokenQuotaMonthly,
      tokenUsageCurrentMonth: data.tokenUsageCurrentMonth,
      quotaResetAt: data.quotaResetAt,
      // Credit system fields
      creditBalance: data.creditBalance,
      creditsUsedCurrentMonth: data.creditsUsedCurrentMonth,
      creditsResetAt: data.creditsResetAt,
      usageAllowanceCredits: data.usageAllowanceCredits,
      spendingLimitUsd: data.spendingLimitUsd,
      billingEmail: data.billingEmail,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      // Storage tracking fields
      storageQuotaBytes: data.storageQuotaBytes,
      storageUsedBytes: data.storageUsedBytes,
      databaseStorageBytes: data.databaseStorageBytes,
      chatStorageBytes: data.chatStorageBytes,
      skillStorageBytes: data.skillStorageBytes,
      workspaceStorageBytes: data.workspaceStorageBytes,
      storageOverageNotifiedAt: data.storageOverageNotifiedAt,
      createdAt: data.createdAt
    };
  }

  protected toPersistence(organization: Organization): any {
    return {
      id: organization.id.value,
      name: organization.name.value,
      slug: organization.slug,
      mission: organization.mission,
      sharedTools: organization.sharedTools,
      sharedServers: organization.sharedServers,
      databaseId: organization.databaseId,
      viewConfig: organization.viewConfig,
      analysisCapabilities: organization.analysisCapabilities,
      plan: organization.plan,
      stripeCustomerId: organization.stripeCustomerId,
      stripeSubscriptionId: organization.stripeSubscriptionId,
      stripeSubscriptionStatus: organization.stripeSubscriptionStatus,
      // Billing and model configuration
      defaultModel: organization.defaultModel,
      availableModels: organization.availableModels,
      tokenQuotaMonthly: organization.tokenQuotaMonthly,
      tokenUsageCurrentMonth: organization.tokenUsageCurrentMonth,
      quotaResetAt: organization.quotaResetAt,
      // Credit system fields
      creditBalance: organization.creditBalance,
      creditsUsedCurrentMonth: organization.creditsUsedCurrentMonth,
      creditsResetAt: organization.creditsResetAt,
      usageAllowanceCredits: organization.usageAllowanceCredits,
      spendingLimitUsd: organization.spendingLimitUsd,
      billingEmail: organization.billingEmail,
      currentPeriodStart: organization.currentPeriodStart,
      currentPeriodEnd: organization.currentPeriodEnd,
      // Storage tracking fields
      storageQuotaBytes: organization.storageQuotaBytes,
      storageUsedBytes: organization.storageUsedBytes,
      databaseStorageBytes: organization.databaseStorageBytes,
      chatStorageBytes: organization.chatStorageBytes,
      skillStorageBytes: organization.skillStorageBytes,
      workspaceStorageBytes: organization.workspaceStorageBytes,
      storageOverageNotifiedAt: organization.storageOverageNotifiedAt,
      createdAt: organization.createdAt
    };
  }
}