import { eq, ilike, and, count } from 'drizzle-orm';
import type postgres from 'postgres';

import { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '@/ddd/domain/organizations/entities/organization';
import { ROLE_TYPES, PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/ddd/domain/roles/entities/role';
import type { DbClient } from '@/lib/db/client';
import { organizations, users, userOrganizations, roles } from '@/lib/db/schema';
import { OrganizationId, UserId, OrganizationRole, OrganizationName, EmailAddress } from '@/ddd/domain/shared/value-objects';

export class DrizzleOrganizationRepository implements IOrganizationRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

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
        role: userOrganizations.role,
        joinedAt: userOrganizations.createdAt,
      })
      .from(userOrganizations)
      .leftJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId.value));

    return result.map(member => ({
      userId: new UserId(member.userId),
      name: member.name,
      email: member.email ? new EmailAddress(member.email) : null,
      role: new OrganizationRole(member.role),
      joinedAt: member.joinedAt
    }));
  }

  async create(data: CreateOrganizationData): Promise<Organization> {
    // Convert Value Objects to database primitives
    const dbData = {
      ...data,
      name: data.name.value // Convert OrganizationName to string
    };
    
    const [result] = await this.db
      .insert(organizations)
      .values(dbData)
      .returning();

    return this.mapToEntity(result);
  }

  async createWithOwner(data: CreateOrganizationData, ownerId: UserId): Promise<Organization> {
    return await this.db.transaction(async (tx) => {
      // Convert Value Objects to database primitives
      const dbData = {
        ...data,
        name: data.name.value // Convert OrganizationName to string
      };
      
      // Create organization
      const [org] = await tx
        .insert(organizations)
        .values(dbData)
        .returning();

      // Create default admin role for this organization
      const [adminRole] = await tx
        .insert(roles)
        .values({
          name: ROLE_TYPES.ADMIN,
          organizationId: org.id,
          permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLE_TYPES.ADMIN]]
        })
        .returning();

      // Create member role for this organization  
      await tx
        .insert(roles)
        .values({
          name: ROLE_TYPES.MEMBER,
          organizationId: org.id,
          permissions: [PERMISSIONS.VIEW_TABLES, PERMISSIONS.CREATE_AGENTS]
        });

      // Add owner as organization member with owner role
      await tx
        .insert(userOrganizations)
        .values({
          userId: ownerId.value,
          organizationId: org.id,
          role: ROLE_TYPES.OWNER
        });

      // Update user's current organization
      await tx
        .update(users)
        .set({ 
          currentOrganizationId: org.id,
          roleId: adminRole.id 
        })
        .where(eq(users.id, ownerId.value));

      return this.mapToEntity(org);
    });
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

      // Clean up roles for this organization
      await tx
        .delete(roles)
        .where(eq(roles.organizationId, id.value));

      // Delete the organization
      await tx
        .delete(organizations)
        .where(eq(organizations.id, id.value));
    });
  }

  async addMember(organizationId: OrganizationId, userId: UserId, role: OrganizationRole = new OrganizationRole(ROLE_TYPES.MEMBER)): Promise<void> {
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
        role: role.value
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

  async updateMemberRole(organizationId: OrganizationId, userId: UserId, role: OrganizationRole): Promise<void> {
    const result = await this.db
      .update(userOrganizations)
      .set({ role: role.value })
      .where(and(
        eq(userOrganizations.organizationId, organizationId.value),
        eq(userOrganizations.userId, userId.value)
      ));
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

  async getUserRole(organizationId: number, userId: string): Promise<string | null> {
    const result = await this.db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userId, userId)
      ),
      columns: {
        role: true
      }
    });

    return result?.role || null;
  }

  async findByName(name: string, limit: number = 10): Promise<Organization[]> {
    const result = await this.db.query.organizations.findMany({
      where: ilike(organizations.name, `%${name}%`),
      limit
    });

    return result.map(org => this.mapToEntity(org));
  }

  // AIDEV-NOTE: Boundary conversion - maps database primitives to domain Value Objects
  private mapToEntity(data: any): Organization {
    return {
      id: new OrganizationId(data.id),
      name: new OrganizationName(data.name),
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