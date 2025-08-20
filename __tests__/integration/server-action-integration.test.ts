import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb } from '@/lib/db/test-client';
import { DIContainer } from '@/lib/application/di/container';
import { DrizzleOrganizationRepository } from '@/lib/infrastructure/db/repositories/drizzle-organization-repository';

// Mock Next.js revalidatePath since it's not available in test environment
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Import the server actions we want to test
import { updateOrganizationViewConfig } from '@/app/actions/organizations';

describe('Server Action Integration Tests', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    
    // Initialize DI container with test database
    const container = DIContainer.getInstance();
    container.reset(); // Reset any previous initialization
    container.initialize(testDb.db, testDb.client);
  });

  afterEach(async () => {
    await testDb.close();
    DIContainer.getInstance().reset();
  });

  describe('Organization Actions', () => {
    it('should update organization view config via repository', async () => {
      const viewConfig = {
        theme: 'dark',
        layout: 'grid',
        showSidebar: true
      };

      // Call the Server Action
      const result = await updateOrganizationViewConfig(1, viewConfig);
      
      expect(result.success).toBe(true);

      // Verify the data was updated in the database
      const org = await testDb.client.query('SELECT view_config FROM organizations WHERE id = $1', [1]);
      expect(org.rows[0].view_config).toEqual(viewConfig);
    });

    it('should handle errors gracefully', async () => {
      // Try to update a non-existent organization
      const result = await updateOrganizationViewConfig(999, { theme: 'dark' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to update view configuration.');
    });
  });

  describe('Repository Integration', () => {
    it('should properly initialize DI container in test environment', () => {
      const container = DIContainer.getInstance();
      expect(container.isReady()).toBe(true);
      
      const registeredRepos = container.getRegisteredRepositories();
      expect(registeredRepos).toContain('IOrganizationRepository');
    });

    it('should use the same database instance across repository and raw queries', async () => {
      // Get repository from DI container
      const container = DIContainer.getInstance();
      const orgRepo = container.get('IOrganizationRepository');
      
      // Create organization via repository
      const orgData = {
        name: 'Integration Test Org',
        mission: 'Testing integration between repository and raw queries'
      };
      
      const newOrg = await orgRepo.create(orgData);
      
      // Verify via raw query that it exists in the same database
      const rawResult = await testDb.client.query(
        'SELECT * FROM organizations WHERE id = $1',
        [newOrg.id]
      );
      
      expect(rawResult.rows).toHaveLength(1);
      expect(rawResult.rows[0].name).toBe(orgData.name);
      expect(rawResult.rows[0].mission).toBe(orgData.mission);
    });
  });

  describe('Business Logic Integration', () => {
    it('should maintain referential integrity across repository operations', async () => {
      // Create a user first
      const userResult = await testDb.client.query('SELECT gen_random_uuid() as uuid');
      const userId = userResult.rows[0].uuid;
      
      await testDb.client.query(
        'INSERT INTO users (id, name, email) VALUES ($1, $2, $3)',
        [userId, 'Integration User', 'integration@test.com']
      );

      // Get repository
      const container = DIContainer.getInstance();
      const orgRepo = container.get('IOrganizationRepository');
      
      // Use createWithOwner (the complex business operation)
      const orgData = {
        name: 'Complex Integration Org',
        mission: 'Testing complex business logic'
      };
      
      const org = await orgRepo.createWithOwner(orgData, userId);
      
      // Verify all related data was created properly
      
      // 1. Organization exists
      expect(org.name).toBe(orgData.name);
      
      // 2. User-organization relationship exists
      const userOrgResult = await testDb.client.query(
        'SELECT * FROM user_organizations WHERE user_id = $1 AND organization_id = $2',
        [userId, org.id]
      );
      expect(userOrgResult.rows).toHaveLength(1);
      expect(userOrgResult.rows[0].role).toBe('owner');
      
      // 3. Default roles were created
      const rolesResult = await testDb.client.query(
        'SELECT name FROM roles WHERE organization_id = $1 ORDER BY name',
        [org.id]
      );
      const roleNames = rolesResult.rows.map(r => r.name);
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('member');
      
      // 4. User's current organization was updated
      const updatedUserResult = await testDb.client.query(
        'SELECT current_organization_id FROM users WHERE id = $1',
        [userId]
      );
      expect(updatedUserResult.rows[0].current_organization_id).toBe(org.id);
    });
  });
});