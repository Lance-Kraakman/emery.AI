import { eq, ilike, and, count } from 'drizzle-orm';
import type postgres from 'postgres';

import { IOrganizationRepository } from '../../../domain/repositories/organization-repository';
import { Organization, CreateOrganizationData, UpdateOrganizationData, OrganizationWithMembers, OrganizationMember } from '../../../domain/entities/organization';
import { ROLE_TYPES, PERMISSIONS } from '../../../domain/entities/role';
import type { DbClient } from '../../../db/client';
import { organizations, users, userOrganizations, roles } from '../../../db/schema';

export class DrizzleOrganizationRepository implements IOrganizationRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

  async findById(id: number): Promise<Organization | null> {
    const result = await this.db.query.organizations.findFirst({
      where: eq(organizations.id, id)
    });

    if (!result) return null;

    return {
      ...result,
      viewConfig: result.viewConfig as Record<string, any> | null
    };
  }

  async findByUserId(userId: string): Promise<Organization[]> {
    const result = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        mission: organizations.mission,
        sharedTools: organizations.sharedTools,
        sharedServers: organizations.sharedServers,
        databaseId: organizations.databaseId,
        viewConfig: organizations.viewConfig,
        plan: organizations.plan,
        stripeCustomerId: organizations.stripeCustomerId,
        stripeSubscriptionId: organizations.stripeSubscriptionId,
        stripeSubscriptionStatus: organizations.stripeSubscriptionStatus,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .innerJoin(userOrganizations, eq(organizations.id, userOrganizations.organizationId))
      .where(eq(userOrganizations.userId, userId));

    return result.map(org => ({
      ...org,
      viewConfig: org.viewConfig as Record<string, any> | null
    }));
  }

  async findByIdWithMembers(id: number): Promise<OrganizationWithMembers | null> {
    const org = await this.findById(id);
    if (!org) return null;

    const members = await this.getMembers(id);
    
    return {
      ...org,
      memberCount: members.length,
      members
    };
  }

  async getMembers(organizationId: number): Promise<OrganizationMember[]> {
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
      .where(eq(userOrganizations.organizationId, organizationId));

    return result;
  }

  async create(data: CreateOrganizationData): Promise<Organization> {
    const [result] = await this.db
      .insert(organizations)
      .values(data)
      .returning();

    return {
      ...result,
      viewConfig: result.viewConfig as Record<string, any> | null
    };
  }

  async createWithOwner(data: CreateOrganizationData, ownerId: string): Promise<Organization> {
    return await this.db.transaction(async (tx) => {
      // Create organization
      const [org] = await tx
        .insert(organizations)
        .values(data)
        .returning();

      // Create default admin role for this organization
      const [adminRole] = await tx
        .insert(roles)
        .values({
          name: ROLE_TYPES.ADMIN,
          organizationId: org.id,
          permissions: [PERMISSIONS.ALL]
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
          userId: ownerId,
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
        .where(eq(users.id, ownerId));

      return {
        ...org,
        viewConfig: org.viewConfig as Record<string, any> | null
      };
    });
  }

  async update(id: number, data: UpdateOrganizationData): Promise<Organization> {
    const [result] = await this.db
      .update(organizations)
      .set(data)
      .where(eq(organizations.id, id))
      .returning();

    if (!result) {
      throw new Error(`Organization with id ${id} not found`);
    }

    return {
      ...result,
      viewConfig: result.viewConfig as Record<string, any> | null
    };
  }

  async delete(id: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Clean up user organization memberships (should cascade)
      await tx
        .delete(userOrganizations)
        .where(eq(userOrganizations.organizationId, id));

      // Clean up roles for this organization
      await tx
        .delete(roles)
        .where(eq(roles.organizationId, id));

      // Delete the organization
      await tx
        .delete(organizations)
        .where(eq(organizations.id, id));
    });
  }

  async addMember(organizationId: number, userId: string, role: string = ROLE_TYPES.MEMBER): Promise<void> {
    // Check if user is already a member
    const existing = await this.db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userId, userId)
      )
    });

    if (existing) {
      throw new Error('User is already a member of this organization');
    }

    await this.db
      .insert(userOrganizations)
      .values({
        userId,
        organizationId,
        role
      });
  }

  async removeMember(organizationId: number, userId: string): Promise<void> {
    const result = await this.db
      .delete(userOrganizations)
      .where(and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userId, userId)
      ));

    // Note: You might want to check if this was the owner and prevent removal,
    // or transfer ownership first
  }

  async updateMemberRole(organizationId: number, userId: string, role: string): Promise<void> {
    const result = await this.db
      .update(userOrganizations)
      .set({ role })
      .where(and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userId, userId)
      ));
  }

  async isMember(organizationId: number, userId: string): Promise<boolean> {
    const result = await this.db.query.userOrganizations.findFirst({
      where: and(
        eq(userOrganizations.organizationId, organizationId),
        eq(userOrganizations.userId, userId)
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

    return result.map(org => ({
      ...org,
      viewConfig: org.viewConfig as Record<string, any> | null
    }));
  }
}