// AIDEV-NOTE: Drizzle implementation of IUserRepository - handles user authentication and management
// Integrates with NextAuth for session management and includes complex business operations

import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type postgres from 'postgres';

import { users, userOrganizations, organizations, sessions } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IUserRepository } from '@/lib/domain/repositories/user-repository';
import type { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserOrganization,
  CreateUserOrganizationData,
  SessionData,
  CreateSessionData
} from '@/lib/domain/entities/user';
import type { Organization } from '@/lib/domain/entities/organization';

export class DrizzleUserRepository implements IUserRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

  // Basic CRUD operations
  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] || null;
  }

  async create(data: CreateUserData): Promise<User> {
    // Generate UUID if not provided
    const userData = {
      ...data,
      id: data.id || crypto.randomUUID(),
    };

    const [newUser] = await this.db
      .insert(users)
      .values(userData)
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    return newUser;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const [updatedUser] = await this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${id} not found or could not be updated`);
    }

    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    // First check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new Error(`User with id ${id} not found`);
    }

    await this.db
      .delete(users)
      .where(eq(users.id, id));
  }

  // API Key management
  async generateApiKey(userId: string): Promise<string> {
    const apiKey = randomBytes(32).toString('hex');

    const [updatedUser] = await this.db
      .update(users)
      .set({ apiKey })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId} not found`);
    }

    return apiKey;
  }

  async findByApiKey(apiKey: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.apiKey, apiKey))
      .limit(1);

    return result[0] || null;
  }

  async revokeApiKey(userId: string): Promise<void> {
    const [updatedUser] = await this.db
      .update(users)
      .set({ apiKey: null })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId} not found`);
    }
  }

  // Organization management
  async switchOrganization(userId: string, organizationId: number): Promise<void> {
    // Verify user is a member of the organization
    const membership = await this.db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership.length) {
      throw new Error(`User ${userId} is not a member of organization ${organizationId}`);
    }

    const [updatedUser] = await this.db
      .update(users)
      .set({ currentOrganizationId: organizationId })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error(`User with id ${userId} not found`);
    }
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const result = await this.db
      .select({
        organization: organizations
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, userId));

    return result.map(r => ({
      ...r.organization,
      viewConfig: r.organization.viewConfig as Record<string, any> | null
    }));
  }

  // User-Organization relationship management
  async addUserToOrganization(data: CreateUserOrganizationData): Promise<UserOrganization> {
    const relationshipData = {
      ...data,
      role: data.role || 'member',
    };

    const [newRelationship] = await this.db
      .insert(userOrganizations)
      .values(relationshipData)
      .returning();

    if (!newRelationship) {
      throw new Error('Failed to create user-organization relationship');
    }

    return newRelationship;
  }

  async removeUserFromOrganization(userId: string, organizationId: number): Promise<void> {
    // First check if user-organization relationship exists
    const existingRole = await this.getUserOrganizationRole(userId, organizationId);
    if (!existingRole) {
      throw new Error(`User ${userId} is not a member of organization ${organizationId}`);
    }

    await this.db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      );
  }

  async getUserOrganizationRole(userId: string, organizationId: number): Promise<string | null> {
    const result = await this.db
      .select({ role: userOrganizations.role })
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    return result[0]?.role || null;
  }

  async updateUserOrganizationRole(userId: string, organizationId: number, role: string): Promise<UserOrganization> {
    const [updatedRelationship] = await this.db
      .update(userOrganizations)
      .set({ role })
      .where(
        and(
          eq(userOrganizations.userId, userId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .returning();

    if (!updatedRelationship) {
      throw new Error(`User-organization relationship not found or could not be updated`);
    }

    return updatedRelationship;
  }

  // Session management (NextAuth integration)
  async createSession(data: CreateSessionData): Promise<void> {
    await this.db
      .insert(sessions)
      .values(data);
  }

  async findSession(sessionToken: string): Promise<SessionData | null> {
    const result = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.sessionToken, sessionToken))
      .limit(1);

    return result[0] || null;
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

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }

  // User queries for admin operations
  async findByOrganizationId(organizationId: number): Promise<User[]> {
    const result = await this.db
      .select({
        user: users
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId));

    return result.map(r => r.user);
  }

  async findByRoleId(roleId: number): Promise<User[]> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.roleId, roleId));

    return result;
  }

  // Business logic operations
  async verifyEmail(userId: string): Promise<User> {
    const [verifiedUser] = await this.db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!verifiedUser) {
      throw new Error(`User with id ${userId} not found`);
    }

    return verifiedUser;
  }

  async updateLastLogin(userId: string): Promise<void> {
    // Note: If we add a lastLoginAt field to schema in the future, implement here
    // For now, this is a placeholder for business logic consistency
    
    // Could potentially update a separate user activity table or add timestamp
    // await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async getUserWithOrganizations(userId: string): Promise<(User & { organizations: Organization[] }) | null> {
    return await this.db.transaction(async (tx) => {
      // Get the user
      const userResult = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
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
        .where(eq(userOrganizations.userId, userId));

      const userOrgs = orgsResult.map(r => ({
        ...r.organization,
        viewConfig: r.organization.viewConfig as Record<string, any> | null
      }));

      return {
        ...user,
        organizations: userOrgs,
      };
    });
  }
}