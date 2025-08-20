import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb } from '@/lib/db/test-client';
import { DrizzleOrganizationRepository } from '@/lib/infrastructure/db/repositories/drizzle-organization-repository';
import { CreateOrganizationData, UpdateOrganizationData } from '@/lib/domain/entities/organization';
import { ROLE_TYPES } from '@/lib/domain/entities/role';

describe('DrizzleOrganizationRepository', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let repository: DrizzleOrganizationRepository;

  beforeEach(async () => {
    testDb = await createTestDb();
    repository = new DrizzleOrganizationRepository(testDb.db, testDb.client);
    // Don't reset here - let each test work with fresh data
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe('Basic CRUD Operations', () => {
    it('should find organization by ID', async () => {
      const org = await repository.findById(1);
      
      expect(org).toBeTruthy();
      expect(org?.name).toBe('Test Org');
      expect(org?.mission).toBe('Testing organization');
      expect(org?.id).toBe(1);
    });

    it('should return null for non-existent organization', async () => {
      const org = await repository.findById(999);
      expect(org).toBeNull();
    });

    it('should create new organization', async () => {
      const orgData: CreateOrganizationData = {
        name: 'New Test Org',
        mission: 'Testing new organization creation',
        plan: 'free'
      };

      const org = await repository.create(orgData);
      
      expect(org).toBeTruthy();
      expect(org.name).toBe(orgData.name);
      expect(org.mission).toBe(orgData.mission);
      expect(org.plan).toBe('free');
      expect(org.id).toBeTruthy();
    });

    it('should update organization', async () => {
      const updateData: UpdateOrganizationData = {
        mission: 'Updated mission statement',
        plan: 'pro'
      };

      const updatedOrg = await repository.update(1, updateData);
      
      expect(updatedOrg.mission).toBe('Updated mission statement');
      expect(updatedOrg.plan).toBe('pro');
      expect(updatedOrg.name).toBe('Test Org'); // Should remain unchanged
    });

    it('should throw error when updating non-existent organization', async () => {
      await expect(repository.update(999, { name: 'Updated' }))
        .rejects.toThrow('Organization with id 999 not found');
    });
  });

  describe('Business Logic Operations', () => {
    it('should create organization with owner and default roles', async () => {
      // Generate UUID for test owner
      const ownerResult = await testDb.client.query('SELECT gen_random_uuid() as uuid');
      const ownerId = ownerResult.rows[0].uuid;

      // Create user first (required for foreign key)
      await testDb.client.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [ownerId, 'New Owner', 'owner@example.com']
      );

      const orgData: CreateOrganizationData = {
        name: 'Startup Inc',
        mission: 'Disrupting the disruption'
      };

      const org = await repository.createWithOwner(orgData, ownerId);
      
      // Verify organization was created
      expect(org.name).toBe('Startup Inc');
      expect(org.mission).toBe('Disrupting the disruption');

      // Verify owner membership was created
      const isMember = await repository.isMember(org.id, ownerId);
      expect(isMember).toBe(true);

      // Verify owner role
      const role = await repository.getUserRole(org.id, ownerId);
      expect(role).toBe(ROLE_TYPES.OWNER);

      // Verify default roles were created
      const rolesResult = await testDb.client.query(
        'SELECT name FROM roles WHERE organization_id = $1 ORDER BY name',
        [org.id]
      );
      const roleNames = rolesResult.rows.map(r => r.name);
      expect(roleNames).toContain(ROLE_TYPES.ADMIN);
      expect(roleNames).toContain(ROLE_TYPES.MEMBER);

      // Verify user's current organization was updated
      const userResult = await testDb.client.query(
        'SELECT current_organization_id FROM users WHERE id = $1',
        [ownerId]
      );
      expect(userResult.rows[0].current_organization_id).toBe(org.id);
    });

    it('should find organizations by user ID', async () => {
      const testUserId = '550e8400-e29b-41d4-a716-446655440000';
      
      const orgs = await repository.findByUserId(testUserId);
      
      expect(orgs).toHaveLength(1);
      expect(orgs[0].name).toBe('Test Org');
    });

    it('should get organization members', async () => {
      const members = await repository.getMembers(1);
      
      expect(members).toHaveLength(1);
      expect(members[0].name).toBe('Test User');
      expect(members[0].email).toBe('test@example.com');
      expect(members[0].userId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should find organization with members', async () => {
      const orgWithMembers = await repository.findByIdWithMembers(1);
      
      expect(orgWithMembers).toBeTruthy();
      expect(orgWithMembers?.name).toBe('Test Org');
      expect(orgWithMembers?.memberCount).toBe(1);
      expect(orgWithMembers?.members).toHaveLength(1);
      expect(orgWithMembers?.members?.[0].name).toBe('Test User');
    });
  });

  describe('Member Management', () => {
    it('should add member to organization', async () => {
      // Create a new user
      const userResult = await testDb.client.query('SELECT gen_random_uuid() as uuid');
      const newUserId = userResult.rows[0].uuid;
      
      await testDb.client.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [newUserId, 'New Member', 'member@example.com']
      );

      await repository.addMember(1, newUserId, ROLE_TYPES.MEMBER);
      
      // Verify membership
      const isMember = await repository.isMember(1, newUserId);
      expect(isMember).toBe(true);

      const role = await repository.getUserRole(1, newUserId);
      expect(role).toBe(ROLE_TYPES.MEMBER);
    });

    it('should prevent adding existing member', async () => {
      const testUserId = '550e8400-e29b-41d4-a716-446655440000';
      
      // Test user is already a member (set up in test data)
      // So adding them again should throw an error
      await expect(repository.addMember(1, testUserId))
        .rejects.toThrow('User is already a member of this organization');
    });

    it('should update member role', async () => {
      const testUserId = '550e8400-e29b-41d4-a716-446655440000';
      
      await repository.updateMemberRole(1, testUserId, ROLE_TYPES.ADMIN);
      
      const role = await repository.getUserRole(1, testUserId);
      expect(role).toBe(ROLE_TYPES.ADMIN);
    });

    it('should remove member from organization', async () => {
      // Add a member first
      const userResult = await testDb.client.query('SELECT gen_random_uuid() as uuid');
      const memberId = userResult.rows[0].uuid;
      
      await testDb.client.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [memberId, 'Temp Member', 'temp@example.com']
      );

      await repository.addMember(1, memberId);
      
      // Verify they're a member
      expect(await repository.isMember(1, memberId)).toBe(true);
      
      // Remove them
      await repository.removeMember(1, memberId);
      
      // Verify they're no longer a member
      expect(await repository.isMember(1, memberId)).toBe(false);
    });
  });

  describe('Search Operations', () => {
    it('should find organizations by name', async () => {
      // Create additional organizations
      await repository.create({ name: 'Test Company 1', mission: 'First test' });
      await repository.create({ name: 'Another Company', mission: 'Different test' });
      await repository.create({ name: 'Test Company 2', mission: 'Second test' });

      const results = await repository.findByName('Test');
      
      expect(results.length).toBeGreaterThanOrEqual(3); // At least our 3 + the original Test Org
      const names = results.map(org => org.name);
      expect(names).toContain('Test Org');
      expect(names).toContain('Test Company 1');
      expect(names).toContain('Test Company 2');
    });

    it('should limit search results', async () => {
      // Create several organizations
      for (let i = 1; i <= 5; i++) {
        await repository.create({ name: `Search Test ${i}`, mission: `Test ${i}` });
      }

      const results = await repository.findByName('Search', 3);
      expect(results).toHaveLength(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle database transaction rollback on createWithOwner failure', async () => {
      const orgData: CreateOrganizationData = {
        name: 'Failed Org'
      };

      // Use non-existent user ID to trigger foreign key constraint failure
      await expect(repository.createWithOwner(orgData, 'non-existent-uuid'))
        .rejects.toThrow();

      // Verify organization was not created
      const orgsResult = await testDb.client.query(
        'SELECT * FROM organizations WHERE name = $1',
        ['Failed Org']
      );
      expect(orgsResult.rows).toHaveLength(0);
    });
  });

  describe('Database Reset', () => {
    it('should maintain consistency after database reset', async () => {
      // Create some data
      await repository.create({ name: 'Temp Org', mission: 'Temporary' });
      
      // Reset database
      await testDb.reset();
      
      // Verify only test data remains
      const org = await repository.findById(1);
      expect(org?.name).toBe('Test Org');
      
      // Verify temp org is gone
      const tempOrgs = await repository.findByName('Temp');
      expect(tempOrgs).toHaveLength(0);
    });
  });
});