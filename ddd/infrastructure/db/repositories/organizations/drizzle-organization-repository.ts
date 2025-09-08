import { eq, ilike, and, count } from 'drizzle-orm';
import type postgres from 'postgres';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import type { DbClient } from '@/lib/db/client';
import { organizations, users, userOrganizations, roles, userRoles } from '@/lib/db/schema';
import { OrganizationId, UserId, OrganizationName, EmailAddress } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';

export class DrizzleOrganizationRepository implements IOrganizationRepository {
  constructor(
    private db: DbClient,
  ) {}

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

  async findById(id: OrganizationId): Promise<Organization | null> {
    const result = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, id.value)
    });

    if (!result) return null;

    return this.mapToEntity(result);
  }

  async findByUserId(userId: UserId): Promise<Organization[]> {
    const result = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        mission: organizations.mission,
        sharedTools: organizations.sharedTools,
        sharedServers: organizations.sharedServers,
        databaseId: organizations.databaseId,
        viewConfig: organizations.viewConfig,
        analysisCapabilities: organizations.analysisCapabilities,
        plan: organizations.plan,
        stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
        stripeSubscriptionStatus: organizations.stripeSubscriptionStatus,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .innerJoin(userOrganizations, eq(organizations.id, userOrganizations.organizationId))
      .where(eq(userOrganizations.userId, userId.value));

    return result.map(org => this.mapToEntity(org));
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
    const result = await this.db
      .select({
        userId: userOrganizations.userId,
        name: users.name,
        email: users.email,
        joinedAt: userOrganizations.createdAt,
      })
      .from(userOrganizations)
      .leftJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId.value));

    throw new Error('getMembers() not implemented for RBAC system. Use permission-based queries instead.');
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

    return this.mapToEntity(result);
  }

  async createWithOwner(data: CreateOrganizationData, ownerId: UserId): Promise<Organization> {
    // Always use transaction for data consistency
    return await this.db.transaction(async (tx) => {
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
    
    // Create organization
    const [org] = await tx
      .insert(organizations)
      .values(dbData)
      .returning();

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

    return this.mapToEntity(org);
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

    return this.mapToEntity(result);
  }

  async delete(id: OrganizationId): Promise<void> {
    await this.db.transaction(async (tx) => {
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
      return result.map(org => this.mapToEntity(org));
    } catch (error) {
      console.log("error finding org", error);
    } finally {
      return []
    }
  }

  // AIDEV-NOTE: Boundary conversion - maps database primitives to domain Value Objects
  private mapToEntity(data: any): Organization {
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
      plan: data.plan,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripeSubscriptionStatus: data.stripeSubscriptionStatus,
      createdAt: data.createdAt
    };
  }
}