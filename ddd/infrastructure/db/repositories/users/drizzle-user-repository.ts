// AIDEV-NOTE: Drizzle implementation of IUserRepository - handles user authentication and management
// Integrates with NextAuth for session management and includes complex business operations

import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type postgres from 'postgres';

import { users, userOrganizations, organizations, sessions } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IUserRepository } from '@/ddd/domain/users/repositories/user-repository';
import type { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserOrganization,
  CreateUserOrganizationData,
  SessionData,
  CreateSessionData
} from '@/ddd/domain/users/entities/user';
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import { UserId, EmailAddress, ApiKey, OrganizationId, OrganizationName, OrganizationRole } from '@/ddd/domain/shared/value-objects';

export class DrizzleUserRepository implements IUserRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

  // Basic CRUD operations
  async findById(id: UserId): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id.value))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  async findByEmail(email: EmailAddress): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
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
      roleId: data.roleId,
      apiKey: data.apiKey?.value || null
    };

    const [newUser] = await this.db
      .insert(users)
      .values(userData)
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return this.mapToEntity(newUser);
  }

  async update(id: UserId, data: UpdateUserData): Promise<User> {
    // Convert Value Objects to primitives for database
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email?.value || null;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.currentOrganizationId !== undefined) updateData.currentOrganizationId = data.currentOrganizationId?.value || null;
    if (data.roleId !== undefined) updateData.roleId = data.roleId;
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.teams !== undefined) updateData.teams = data.teams;
    // Note: apiKey updates handled through separate methods for security

    const [updatedUser] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id.value))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${id.value} not found or could not be updated`);
    }

    return this.mapToEntity(updatedUser);
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

  // API Key management
  async generateApiKey(userId: UserId): Promise<ApiKey> {
    const apiKey = ApiKey.generate();

    const [updatedUser] = await this.db
      .update(users)
      .set({ apiKey: apiKey.value })
      .where(eq(users.id, userId.value))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId.value} not found`);
    }

    return apiKey;
  }

  async findByApiKey(apiKey: ApiKey): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.apiKey, apiKey.value))
      .limit(1);

    return result[0] ? this.mapToEntity(result[0]) : null;
  }

  async revokeApiKey(userId: UserId): Promise<void> {
    const [updatedUser] = await this.db
      .update(users)
      .set({ apiKey: null })
      .where(eq(users.id, userId.value))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId.value} not found`);
    }
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
    const result = await this.db
      .select({
        organization: organizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, userId.value));

    return result.map(r => ({
      ...r.organization,
      id: OrganizationId.fromNumber(r.organization.id),
      name: OrganizationName.fromString(r.organization.name),
      viewConfig: r.organization.viewConfig as Record<string, any> | null
    }));
  }

  // User-Organization relationship management
  async addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization> {
    const relationshipData = {
      userId: data.userId.value,
      organizationId: data.organizationId.value,
      role: data.role ? data.role.value : 'member',
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
      role: OrganizationRole.fromString(newRelationship.role),
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

  async getUserOrganizationRole(userId: UserId, organizationId: OrganizationId): Promise<OrganizationRole | null> {
    // Add defensive check
    if (!organizationId || !organizationId.value) {
      console.error('Invalid organizationId passed to getUserOrganizationRole:', organizationId);
      return null;
    }
    
    const result = await this.db
      .select({ role: userOrganizations.role })
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId.value),
          eq(userOrganizations.organizationId, organizationId.value)
        )
      )
      .limit(1);

    return result[0]?.role ? OrganizationRole.fromString(result[0].role) : null;
  }

  async updateUserOrganizationRole(userId: UserId, organizationId: OrganizationId, role: OrganizationRole): Promise<UserOrganization> {
    const [updatedRelationship] = await this.db
      .update(userOrganizations)
      .set({ role: role.value })
      .where(
        and(
          eq(userOrganizations.userId, userId.value),
          eq(userOrganizations.organizationId, organizationId.value)
        )
      )
      .returning();

    if (!updatedRelationship) {
      throw new Error(`User-organization relationship not found or could not be updated`);
    }

    // Convert database result back to domain entity
    return {
      id: updatedRelationship.id,
      userId: UserId.fromString(updatedRelationship.userId),
      organizationId: OrganizationId.fromNumber(updatedRelationship.organizationId),
      role: OrganizationRole.fromString(updatedRelationship.role),
      createdAt: updatedRelationship.createdAt
    };
  }

  // Session management (NextAuth integration)
  async createSession(data: CreateSessionData): Promise<void> {
    // Convert Value Objects to primitives for database
    const sessionData = {
      sessionToken: data.sessionToken,
      userId: data.userId.value, // UserId is always a value object here
      expires: data.expires
    };
    
    await this.db
      .insert(sessions)
      .values(sessionData);
  }

  async findSession(sessionToken: string): Promise<SessionData | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    if (!result[0]) {
      return null;
    }

    // Convert database result back to domain entity
    return {
      sessionToken: result[0].sessionToken,
      userId: UserId.fromString(result[0].userId),
      expires: result[0].expires
    };
  }

  async deleteSession(sessionToken: string): Promise<void> {
    // First check if session exists
    const existingSession = await this.findSession(sessionToken);
    if (!existingSession) {
      throw new Error(`Session with token ${sessionToken} not found`);
    }

    await this.db
      .delete(sessions)
      .where(eq(sessions.sessionToken, sessionToken));
  }

  async deleteAllUserSessions(userId: UserId): Promise<void> {
    await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId.value));
  }

  // User queries for admin operations
  async findByOrganizationId(organizationId: OrganizationId): Promise<User[]> {
    const result = await this.db
      .select({
        user: users
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId.value));

    return result.map(r => this.mapToEntity(r.user));
  }

  async findByRoleId(roleId: number): Promise<User[]> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.roleId, roleId));

    return result.map(user => this.mapToEntity(user));
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

    return this.mapToEntity(verifiedUser);
  }

  async updateLastLogin(userId: UserId): Promise<void> {
    // Note: If we add a lastLoginAt field to schema in the future, implement here
    // For now, this is a placeholder for business logic consistency
    
    // Could potentially update a separate user activity table or add timestamp
    // await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId.value));
  }

  async getUserWithOrganizations(userId: UserId): Promise<(User & { organizations: Organization[] }) | null> {
    return await this.db.transaction(async (tx) => {
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

      const userOrgs = orgsResult.map(r => ({
        ...r.organization,
        id: OrganizationId.fromNumber(r.organization.id),
        name: OrganizationName.fromString(r.organization.name),
        viewConfig: r.organization.viewConfig as Record<string, any> | null
      }));

      return {
        ...this.mapToEntity(user),
        organizations: userOrgs,
      };
    });
  }

  // AIDEV-NOTE: Boundary conversion - maps database primitives to domain Value Objects
  private mapToEntity(data: any): User {
    return {
      id: UserId.fromString(data.id),
      name: data.name,
      email: data.email ? EmailAddress.fromString(data.email) : null,
      emailVerified: data.emailVerified,
      image: data.image,
      currentOrganizationId: data.currentOrganizationId ? OrganizationId.fromNumber(data.currentOrganizationId) : null,
      roleId: data.roleId,
      apiKey: data.apiKey ? ApiKey.fromString(data.apiKey) : null,
      createdAt: data.createdAt
    };
  }
}