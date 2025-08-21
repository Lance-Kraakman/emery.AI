// AIDEV-NOTE: Comprehensive User repository tests - covers authentication, session management, and user operations
// Uses PGlite in-memory database with real migration files for realistic testing

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleUserRepository } from '@/lib/infrastructure/db/repositories/drizzle-user-repository';
import { DrizzleOrganizationRepository } from '@/lib/infrastructure/db/repositories/drizzle-organization-repository';
import { createTestDb } from '@/lib/db/test-client';
import type { 
  User, 
  CreateUserData, 
  UpdateUserData,
  CreateUserOrganizationData,
  CreateSessionData
} from '@/lib/domain/entities/user';
import type { CreateOrganizationData } from '@/lib/domain/entities/organization';

describe('DrizzleUserRepository', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let userRepository: DrizzleUserRepository;
  let orgRepository: DrizzleOrganizationRepository;
  let testUser: User;
  let testOrganizationId: number;

  beforeEach(async () => {
    testDb = await createTestDb();
    userRepository = new DrizzleUserRepository(testDb.db, testDb.client);
    orgRepository = new DrizzleOrganizationRepository(testDb.db, testDb.client);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // Setup helper to create test data
  const createTestOrganization = async () => {
    const orgData: CreateOrganizationData = {
      name: 'Test Organization',
      mission: 'Testing user repository',
    };
    return await orgRepository.create(orgData);
  };

  const createTestUser = async (email = 'test@example.com'): Promise<User> => {
    const userData: CreateUserData = {
      email,
      name: 'Test User',
      jobTitle: 'Developer',
    };
    return await userRepository.create(userData);
  };

  describe('Basic CRUD Operations', () => {
    it('should create a user with required fields', async () => {
      const userData: CreateUserData = {
        email: 'john@example.com',
        name: 'John Doe',
        jobTitle: 'Software Engineer',
      };

      const user = await userRepository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.email).toBe('john@example.com');
      expect(user.name).toBe('John Doe');
      expect(user.jobTitle).toBe('Software Engineer');
      expect(user.createdAt).toBeDefined();
    });

    it('should create a user with custom UUID', async () => {
      const customId = '12345678-1234-1234-1234-123456789abc'; // Valid UUID format
      const userData: CreateUserData = {
        id: customId,
        email: 'custom@example.com',
        name: 'Custom User',
      };

      const user = await userRepository.create(userData);

      expect(user.id).toBe(customId);
      expect(user.email).toBe('custom@example.com');
    });

    it('should find user by ID', async () => {
      testUser = await createTestUser('findbyid@example.com');

      const foundUser = await userRepository.findById(testUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe('findbyid@example.com');
    });

    it('should return null for non-existent user ID', async () => {
      const foundUser = await userRepository.findById('00000000-0000-0000-0000-000000000000');

      expect(foundUser).toBeNull();
    });

    it('should find user by email', async () => {
      testUser = await createTestUser('findemail@example.com');

      const foundUser = await userRepository.findByEmail('findemail@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.email).toBe('findemail@example.com');
    });

    it('should return null for non-existent email', async () => {
      const foundUser = await userRepository.findByEmail('nonexistent@example.com');

      expect(foundUser).toBeNull();
    });

    it('should update user profile', async () => {
      testUser = await createTestUser('update@example.com');

      const updateData: UpdateUserData = {
        name: 'Updated Name',
        jobTitle: 'Senior Developer',
        teams: ['team1', 'team2'],
      };

      const updatedUser = await userRepository.update(testUser.id, updateData);

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.jobTitle).toBe('Senior Developer');
      expect(updatedUser.teams).toEqual(['team1', 'team2']);
      expect(updatedUser.email).toBe('update@example.com'); // Unchanged
    });

    it('should throw error when updating non-existent user', async () => {
      const nonExistentId = '11111111-1111-1111-1111-111111111111';
      const updateData: UpdateUserData = {
        name: 'New Name',
      };

      await expect(userRepository.update(nonExistentId, updateData))
        .rejects.toThrow(`User with id ${nonExistentId} not found`);
    });

    it('should delete user', async () => {
      testUser = await createTestUser('delete@example.com');

      await userRepository.delete(testUser.id);

      const foundUser = await userRepository.findById(testUser.id);
      expect(foundUser).toBeNull();
    });

    it('should throw error when deleting non-existent user', async () => {
      const nonExistentId = '22222222-2222-2222-2222-222222222222';
      await expect(userRepository.delete(nonExistentId))
        .rejects.toThrow(`User with id ${nonExistentId} not found`);
    });
  });

  describe('API Key Management', () => {
    beforeEach(async () => {
      testUser = await createTestUser('apikey@example.com');
    });

    it('should generate API key for user', async () => {
      const apiKey = await userRepository.generateApiKey(testUser.id);

      expect(apiKey).toBeDefined();
      expect(typeof apiKey).toBe('string');
      expect(apiKey.length).toBe(64); // 32 bytes as hex = 64 characters

      // Verify user has the API key
      const updatedUser = await userRepository.findById(testUser.id);
      expect(updatedUser!.apiKey).toBe(apiKey);
    });

    it('should find user by API key', async () => {
      const apiKey = await userRepository.generateApiKey(testUser.id);

      const foundUser = await userRepository.findByApiKey(apiKey);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(testUser.id);
      expect(foundUser!.apiKey).toBe(apiKey);
    });

    it('should return null for invalid API key', async () => {
      const foundUser = await userRepository.findByApiKey('invalid-api-key');

      expect(foundUser).toBeNull();
    });

    it('should revoke API key', async () => {
      const apiKey = await userRepository.generateApiKey(testUser.id);
      
      // Verify API key exists
      const userWithKey = await userRepository.findByApiKey(apiKey);
      expect(userWithKey).toBeDefined();

      await userRepository.revokeApiKey(testUser.id);

      // Verify API key is removed
      const userAfterRevoke = await userRepository.findById(testUser.id);
      expect(userAfterRevoke!.apiKey).toBeNull();

      // Verify can't find by old API key
      const foundByOldKey = await userRepository.findByApiKey(apiKey);
      expect(foundByOldKey).toBeNull();
    });

    it('should throw error when generating API key for non-existent user', async () => {
      const nonExistentId = '33333333-3333-3333-3333-333333333333';
      await expect(userRepository.generateApiKey(nonExistentId))
        .rejects.toThrow(`User with id ${nonExistentId} not found`);
    });
  });

  describe('Organization Management', () => {
    beforeEach(async () => {
      testUser = await createTestUser('orgmanagement@example.com');
      const org = await createTestOrganization();
      testOrganizationId = org.id;
    });

    it('should switch user to organization', async () => {
      // First add user to organization
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'member'
      });

      await userRepository.switchOrganization(testUser.id, testOrganizationId);

      const updatedUser = await userRepository.findById(testUser.id);
      expect(updatedUser!.currentOrganizationId).toBe(testOrganizationId);
    });

    it('should throw error when switching to organization user is not member of', async () => {
      await expect(userRepository.switchOrganization(testUser.id, testOrganizationId))
        .rejects.toThrow(`User ${testUser.id} is not a member of organization ${testOrganizationId}`);
    });

    it('should get user organizations', async () => {
      // Add user to organization
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'admin'
      });

      const organizations = await userRepository.getUserOrganizations(testUser.id);

      expect(organizations).toHaveLength(1);
      expect(organizations[0].id).toBe(testOrganizationId);
      expect(organizations[0].name).toBe('Test Organization');
    });

    it('should return empty array for user with no organizations', async () => {
      const organizations = await userRepository.getUserOrganizations(testUser.id);

      expect(organizations).toHaveLength(0);
    });
  });

  describe('User-Organization Relationships', () => {
    beforeEach(async () => {
      testUser = await createTestUser('userorg@example.com');
      const org = await createTestOrganization();
      testOrganizationId = org.id;
    });

    it('should add user to organization with default role', async () => {
      const relationshipData: CreateUserOrganizationData = {
        userId: testUser.id,
        organizationId: testOrganizationId,
      };

      const relationship = await userRepository.addUserToOrganization(relationshipData);

      expect(relationship.userId).toBe(testUser.id);
      expect(relationship.organizationId).toBe(testOrganizationId);
      expect(relationship.role).toBe('member'); // Default role
      expect(relationship.createdAt).toBeDefined();
    });

    it('should add user to organization with specific role', async () => {
      const relationshipData: CreateUserOrganizationData = {
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'admin',
      };

      const relationship = await userRepository.addUserToOrganization(relationshipData);

      expect(relationship.role).toBe('admin');
    });

    it('should get user organization role', async () => {
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'editor',
      });

      const role = await userRepository.getUserOrganizationRole(testUser.id, testOrganizationId);

      expect(role).toBe('editor');
    });

    it('should return null for non-member user role', async () => {
      const role = await userRepository.getUserOrganizationRole(testUser.id, testOrganizationId);

      expect(role).toBeNull();
    });

    it('should update user organization role', async () => {
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'member',
      });

      const updatedRelationship = await userRepository.updateUserOrganizationRole(
        testUser.id, 
        testOrganizationId, 
        'admin'
      );

      expect(updatedRelationship.role).toBe('admin');

      // Verify the change persisted
      const role = await userRepository.getUserOrganizationRole(testUser.id, testOrganizationId);
      expect(role).toBe('admin');
    });

    it('should remove user from organization', async () => {
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: testOrganizationId,
        role: 'member',
      });

      // Verify user is member
      const roleBefore = await userRepository.getUserOrganizationRole(testUser.id, testOrganizationId);
      expect(roleBefore).toBe('member');

      await userRepository.removeUserFromOrganization(testUser.id, testOrganizationId);

      // Verify user is no longer member
      const roleAfter = await userRepository.getUserOrganizationRole(testUser.id, testOrganizationId);
      expect(roleAfter).toBeNull();
    });

    it('should throw error when removing user not in organization', async () => {
      await expect(userRepository.removeUserFromOrganization(testUser.id, testOrganizationId))
        .rejects.toThrow(`User ${testUser.id} is not a member of organization ${testOrganizationId}`);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      testUser = await createTestUser('session@example.com');
    });

    it('should create session', async () => {
      const sessionData: CreateSessionData = {
        sessionToken: 'test-session-token',
        userId: testUser.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      await userRepository.createSession(sessionData);

      const foundSession = await userRepository.findSession(sessionData.sessionToken);
      expect(foundSession).toBeDefined();
      expect(foundSession!.userId).toBe(testUser.id);
      expect(foundSession!.sessionToken).toBe('test-session-token');
    });

    it('should find session by token', async () => {
      const sessionData: CreateSessionData = {
        sessionToken: 'find-session-token',
        userId: testUser.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await userRepository.createSession(sessionData);

      const foundSession = await userRepository.findSession('find-session-token');

      expect(foundSession).toBeDefined();
      expect(foundSession!.userId).toBe(testUser.id);
    });

    it('should return null for non-existent session', async () => {
      const foundSession = await userRepository.findSession('non-existent-token');

      expect(foundSession).toBeNull();
    });

    it('should delete session', async () => {
      const sessionData: CreateSessionData = {
        sessionToken: 'delete-session-token',
        userId: testUser.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      await userRepository.createSession(sessionData);

      // Verify session exists
      const sessionBefore = await userRepository.findSession('delete-session-token');
      expect(sessionBefore).toBeDefined();

      await userRepository.deleteSession('delete-session-token');

      // Verify session is deleted
      const sessionAfter = await userRepository.findSession('delete-session-token');
      expect(sessionAfter).toBeNull();
    });

    it('should throw error when deleting non-existent session', async () => {
      await expect(userRepository.deleteSession('non-existent-token'))
        .rejects.toThrow('Session with token non-existent-token not found');
    });

    it('should delete all user sessions', async () => {
      // Create multiple sessions for user
      await userRepository.createSession({
        sessionToken: 'session1',
        userId: testUser.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      await userRepository.createSession({
        sessionToken: 'session2',
        userId: testUser.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Verify sessions exist
      const session1Before = await userRepository.findSession('session1');
      const session2Before = await userRepository.findSession('session2');
      expect(session1Before).toBeDefined();
      expect(session2Before).toBeDefined();

      await userRepository.deleteAllUserSessions(testUser.id);

      // Verify all sessions are deleted
      const session1After = await userRepository.findSession('session1');
      const session2After = await userRepository.findSession('session2');
      expect(session1After).toBeNull();
      expect(session2After).toBeNull();
    });
  });

  describe('Admin Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
    });

    it('should find users by organization ID', async () => {
      // Create multiple users and add them to organization
      const user1 = await createTestUser('org1@example.com');
      const user2 = await createTestUser('org2@example.com');
      const user3 = await createTestUser('noorg@example.com'); // Not in organization

      await userRepository.addUserToOrganization({
        userId: user1.id,
        organizationId: testOrganizationId,
      });
      await userRepository.addUserToOrganization({
        userId: user2.id,
        organizationId: testOrganizationId,
      });

      const orgUsers = await userRepository.findByOrganizationId(testOrganizationId);

      expect(orgUsers).toHaveLength(2);
      const userEmails = orgUsers.map(u => u.email);
      expect(userEmails).toContain('org1@example.com');
      expect(userEmails).toContain('org2@example.com');
      expect(userEmails).not.toContain('noorg@example.com');
    });

    it('should return empty array for organization with no users', async () => {
      const orgUsers = await userRepository.findByOrganizationId(testOrganizationId);

      expect(orgUsers).toHaveLength(0);
    });
  });

  describe('Business Logic Operations', () => {
    beforeEach(async () => {
      testUser = await createTestUser('business@example.com');
    });

    it('should verify user email', async () => {
      // Create user without email verification
      const unverifiedUser = await createTestUser('unverified@example.com');
      expect(unverifiedUser.emailVerified).toBeNull();

      const verifiedUser = await userRepository.verifyEmail(unverifiedUser.id);

      expect(verifiedUser.emailVerified).toBeDefined();
      expect(verifiedUser.emailVerified).toBeInstanceOf(Date);
    });

    it('should throw error when verifying non-existent user email', async () => {
      const nonExistentId = '44444444-4444-4444-4444-444444444444';
      await expect(userRepository.verifyEmail(nonExistentId))
        .rejects.toThrow(`User with id ${nonExistentId} not found`);
    });

    it('should get user with organizations', async () => {
      const org1 = await createTestOrganization();
      const org2Data: CreateOrganizationData = {
        name: 'Second Organization',
        mission: 'Another test org',
      };
      const org2 = await orgRepository.create(org2Data);

      // Add user to both organizations
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: org1.id,
        role: 'admin',
      });
      await userRepository.addUserToOrganization({
        userId: testUser.id,
        organizationId: org2.id,
        role: 'member',
      });

      const userWithOrgs = await userRepository.getUserWithOrganizations(testUser.id);

      expect(userWithOrgs).toBeDefined();
      expect(userWithOrgs!.id).toBe(testUser.id);
      expect(userWithOrgs!.organizations).toHaveLength(2);

      const orgNames = userWithOrgs!.organizations.map(org => org.name);
      expect(orgNames).toContain('Test Organization');
      expect(orgNames).toContain('Second Organization');
    });

    it('should return null for non-existent user with organizations', async () => {
      const nonExistentId = '55555555-5555-5555-5555-555555555555';
      const userWithOrgs = await userRepository.getUserWithOrganizations(nonExistentId);

      expect(userWithOrgs).toBeNull();
    });

    it('should update last login (placeholder)', async () => {
      // This is a placeholder method for future functionality
      await expect(userRepository.updateLastLogin(testUser.id)).resolves.toBeUndefined();
    });
  });
});