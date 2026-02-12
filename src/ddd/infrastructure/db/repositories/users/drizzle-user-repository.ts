// AIDEV-NOTE: Drizzle implementation of IUserRepository - handles user authentication and management
// User business operations with organization relationships and role management

import { eq, and, ne } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

import { users, userOrganizations, organizations } from '@/ddd/infrastructure/db/schema';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import { DrizzleBaseRepository } from '../base/drizzle-base-repository';
import type {
  User,
  CreateUserData,
  UpdateUserData,
  UserOrganization,
  CreateUserOrganizationData
} from '@/ddd/domain/users/entities/user';
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import { UserId, EmailAddress, OrganizationId, OrganizationName } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType, SYSTEM_ROLES } from '@/ddd/domain/rbac/entities/role';
import { SYSTEM_USER_ID_VALUE } from '@/ddd/infrastructure/db/system-context';

type UserRow = InferSelectModel<typeof users>;

export class DrizzleUserRepository
  extends DrizzleBaseRepository<User, UserId, CreateUserData, UpdateUserData, UserRow>
  implements IUserRepository {

  protected readonly table = users;
  protected readonly idColumn = users.id;
  protected readonly organizationColumn = undefined; // Users are not org-scoped directly


  // Basic CRUD operations - findById inherited from DrizzleBaseRepository

  async findByEmail(email: EmailAddress): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    return result[0] ? this.fromPersistence(result[0]) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    // Convert Value Objects to primitives for database
    const userData = {
      id: data.id?.value || crypto.randomUUID(),
      name: data.name,
      email: data.email?.value || null,
      emailVerified: data.emailVerified,
      image: data.image,
      currentOrganizationId: data.currentOrganizationId?.value || null,
    };

    const [newUser] = await this.db
      .insert(users)
      .values(userData)
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return this.fromPersistence(newUser);
  }

  async update(id: UserId, data: UpdateUserData): Promise<User> {
    // Convert Value Objects to primitives for database
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email?.value || null;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.currentOrganizationId !== undefined) updateData.currentOrganizationId = data.currentOrganizationId?.value || null;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.teams !== undefined) updateData.teams = data.teams;

    const [updatedUser] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id.value))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${id.value} not found or could not be updated`);
    }

    return this.fromPersistence(updatedUser);
  }

  async delete(id: UserId): Promise<void> {
    // First check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new Error(`User with id ${id.value} not found`);
    }

    await this.db
      .delete(users)
      .where(eq(users.id, id.value));
  }

  // AIDEV-NOTE: Role management now handled through RBAC system
  async updateUserRole(userId: UserId, role: string): Promise<User> {
    throw new Error('Role updates not yet implemented for RBAC system. Use role management through user_roles table.');
  }

  // Organization management
  async switchOrganization(userId: UserId, organizationId: OrganizationId): Promise<void> {
    // Verify user is a member of the organization
    const membership = await this.db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId.value),
          eq(userOrganizations.organizationId, organizationId.value)
        )
      )
      .limit(1);

    if (!membership.length) {
      throw new Error(`User ${userId.value} is not a member of organization ${organizationId.value}`);
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({ currentOrganizationId: organizationId.value })
      .where(eq(users.id, userId.value))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId.value} not found`);
    }
  }

  async getUserOrganizations(userId: UserId): Promise<Organization[]> {
    console.log("🗃️ DrizzleUserRepository.getUserOrganizations() - Querying for user:", userId.value);

    const result = await this.db
      .select({
        organization: organizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, userId.value));

    console.log("🗃️ DrizzleUserRepository.getUserOrganizations() - Raw query result:", {
      count: result.length,
      results: result.map((r: { organization: any }) => ({
        orgId: r.organization.id,
        orgName: r.organization.name,
        orgSlug: r.organization.slug
      }))
    });

    const mappedResults = result.map((r: { organization: any }) => ({
      ...r.organization,
      id: OrganizationId.fromNumber(r.organization.id),
      name: OrganizationName.fromString(r.organization.name),
      viewConfig: r.organization.viewConfig as Record<string, any> | null
    }));

    console.log("🗃️ DrizzleUserRepository.getUserOrganizations() - Mapped results:", mappedResults.length);

    return mappedResults;
  }

  // User-Organization relationship management
  async addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization> {
    const relationshipData = {
      userId: data.userId.value,
      organizationId: data.organizationId.value,
    };

    const [newRelationship] = await this.db
      .insert(userOrganizations)
      .values(relationshipData)
      .returning();

    if (!newRelationship) {
      throw new Error('Failed to create user-organization relationship');
    }

    // Convert database result back to domain entity
    return {
      id: newRelationship.id,
      userId: UserId.fromString(newRelationship.userId),
      organizationId: OrganizationId.fromNumber(newRelationship.organizationId),
      systemRole: SYSTEM_ROLES.MEMBER, // Default system role for new relationships
      createdAt: newRelationship.createdAt
    };
  }

  async removeUserFromOrganization(userId: UserId, organizationId: OrganizationId): Promise<void> {
    // First check if user-organization relationship exists
    const existingRole = await this.getUserOrganizationRole(userId, organizationId);
    if (!existingRole) {
      throw new Error(`User ${userId.value} is not a member of organization ${organizationId.value}`);
    }

    await this.db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId.value),
          eq(userOrganizations.organizationId, organizationId.value)
        )
      );
  }


  async updateUserOrganizationRole(userId: UserId, organizationId: OrganizationId, systemRole: SystemRoleType): Promise<UserOrganization> {
    throw new Error('Role updates not yet implemented for RBAC system. Use role management through user_roles table.');
  }


  // User queries for admin operations
  async findByOrganizationId(organizationId: OrganizationId): Promise<User[]> {
    const result = await this.db
      .select({
        user: users
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(
        and(
          eq(userOrganizations.organizationId, organizationId.value),
          ne(users.id, SYSTEM_USER_ID_VALUE) // Exclude system scheduler user from UI
        )
      );

    return result.map((r: { user: UserRow }) => this.fromPersistence(r.user));
  }

  async findByRole(organizationId: OrganizationId, role: string): Promise<User[]> {
    const result = await this.db
      .select({
        user: users
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(
        and(
          eq(userOrganizations.organizationId, organizationId.value),
          ne(users.id, SYSTEM_USER_ID_VALUE) // Exclude system scheduler user from UI
        )
      );

    return result.map((r: { user: UserRow }) => this.fromPersistence(r.user));
  }

  // Business logic operations
  async verifyEmail(userId: UserId): Promise<User> {
    const [verifiedUser] = await this.db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, userId.value))
      .returning();

    if (!verifiedUser) {
      throw new Error(`User with id ${userId.value} not found`);
    }

    return this.fromPersistence(verifiedUser);
  }



  async getUserWithOrganizations(userId: UserId): Promise<(User & { organizations: Organization[] }) | null> {
    return await this.db.transaction(async (tx: any) => {
      // Get the user
      const userResult = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId.value))
        .limit(1);

      const user = userResult[0];
      if (!user) {
        return null;
      }

      // Get user's organizations
      const orgsResult = await tx
        .select({
          organization: organizations
        })
        .from(userOrganizations)
        .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
        .where(eq(userOrganizations.userId, userId.value));

      const userOrgs = orgsResult.map((r: { organization: any }) => ({
        ...r.organization,
        id: OrganizationId.fromNumber(r.organization.id),
        name: OrganizationName.fromString(r.organization.name),
        viewConfig: r.organization.viewConfig as Record<string, any> | null
      }));

      return {
        ...this.fromPersistence(user),
        organizations: userOrgs,
      };
    });
  }

  async getUserOrganizationRole(userId: UserId, organizationId: OrganizationId): Promise<string | null> {
    const result = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userOrganizations, eq(users.id, userOrganizations.userId))
      .where(
        and(
          eq(users.id, userId.value),
          eq(userOrganizations.organizationId, organizationId.value)
        )
      )
      .limit(1);

    // TODO: Implement role lookup via RBAC system
    return result[0] ? 'member' : null;
  }

  // AIDEV-NOTE: Base repository interface - maps database primitives to domain Value Objects
  protected fromPersistence(data: UserRow): User {
    return {
      id: UserId.fromString(data.id),
      name: data.name,
      email: data.email ? EmailAddress.fromString(data.email) : null,
      emailVerified: data.emailVerified,
      image: data.image,
      currentOrganizationId: data.currentOrganizationId ? OrganizationId.fromNumber(data.currentOrganizationId) : null,
      createdAt: data.createdAt
    };
  }

  // AIDEV-NOTE: Base repository interface - maps domain objects to database primitives
  protected toPersistence(user: User): any {
    return {
      id: user.id.value,
      name: user.name,
      email: user.email?.value || null,
      emailVerified: user.emailVerified,
      image: user.image,
      currentOrganizationId: user.currentOrganizationId?.value || null,
      createdAt: user.createdAt
    };
  }
}
