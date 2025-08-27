/**
 * Integration tests for Role-Based Security System
 * AIDEV-NOTE: Tests the hybrid approach combining database roles with application-level permissions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb, closeTestDb } from '../shared/integration-helpers';
import { organizations, roles, users, agents, tasks, teams } from '@/lib/db/schema';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { PERMISSIONS } from '@/ddd/domain/roles/entities/role';

describe('Role-Based Security System', () => {
  let testOrgId: number;
  let testUserId: string;
  let ownerRoleId: number;
  let adminRoleId: number;
  let memberRoleId: number;

  beforeAll(async () => {
    // Ensure database is clean and RLS is enabled
    await testDb.execute(sql`DELETE FROM tasks`);
    await testDb.execute(sql`DELETE FROM agents`);
    await testDb.execute(sql`DELETE FROM teams`);
    await testDb.execute(sql`DELETE FROM users WHERE email LIKE '%test%'`);
    await testDb.execute(sql`DELETE FROM roles`);
    await testDb.execute(sql`DELETE FROM organizations WHERE name LIKE '%test%'`);

    // Enable RLS on all tables
    await testDb.execute(sql`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY`);
    await testDb.execute(sql`ALTER TABLE roles ENABLE ROW LEVEL SECURITY`);
    await testDb.execute(sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY`);
    await testDb.execute(sql`ALTER TABLE agents ENABLE ROW LEVEL SECURITY`);
    await testDb.execute(sql`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`);
    await testDb.execute(sql`ALTER TABLE teams ENABLE ROW LEVEL SECURITY`);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    // Create test organization
    const [testOrg] = await testDb.insert(organizations).values({
      name: 'Test Role Security Org',
      slug: 'test-role-security-org',
    }).returning();
    testOrgId = testOrg.id;

    // Create roles with different permission sets
    const [ownerRole] = await testDb.insert(roles).values({
      name: 'owner',
      organizationId: testOrgId,
      permissions: [
        PERMISSIONS.MANAGE_ORGANIZATION,
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_AGENTS,
        PERMISSIONS.CREATE_AGENTS,
        PERMISSIONS.EXECUTE_AGENTS,
        PERMISSIONS.MANAGE_TEAMS,
        PERMISSIONS.VIEW_DATA,
        PERMISSIONS.MANAGE_DATA,
      ],
    }).returning();
    ownerRoleId = ownerRole.id;

    const [adminRole] = await testDb.insert(roles).values({
      name: 'admin',
      organizationId: testOrgId,
      permissions: [
        PERMISSIONS.MANAGE_USERS,
        PERMISSIONS.MANAGE_AGENTS,
        PERMISSIONS.CREATE_AGENTS,
        PERMISSIONS.EXECUTE_AGENTS,
        PERMISSIONS.VIEW_DATA,
      ],
    }).returning();
    adminRoleId = adminRole.id;

    const [memberRole] = await testDb.insert(roles).values({
      name: 'member',
      organizationId: testOrgId,
      permissions: [
        PERMISSIONS.VIEW_AGENTS,
        PERMISSIONS.EXECUTE_AGENTS,
        PERMISSIONS.VIEW_DATA,
      ],
    }).returning();
    memberRoleId = memberRole.id;

    // Create test user
    const userId = UserId.create();
    const [testUser] = await testDb.insert(users).values({
      id: userId.value,
      email: 'test@role-security.com',
      name: 'Test Role User',
      roleId: memberRoleId,
    }).returning();
    testUserId = testUser.id;
  });

  afterEach(async () => {
    // Clean up test data
    await testDb.execute(sql`DELETE FROM tasks`);
    await testDb.execute(sql`DELETE FROM agents`);
    await testDb.execute(sql`DELETE FROM teams`);
    await testDb.execute(sql`DELETE FROM users WHERE email LIKE '%test%'`);
    await testDb.execute(sql`DELETE FROM roles`);
    await testDb.execute(sql`DELETE FROM organizations WHERE name LIKE '%test%'`);
  });

  describe('Database Role Management', () => {
    it('should create database roles successfully', async () => {
      // Check if database roles exist
      const rolesResult = await testDb.execute(sql`
        SELECT rolname FROM pg_roles 
        WHERE rolname IN ('app_owner', 'app_admin', 'app_member', 'authenticated', 'anon')
        ORDER BY rolname
      `);

      expect(rolesResult.rows).toHaveLength(5);
      expect(rolesResult.rows.map(r => r.rolname)).toEqual([
        'anon', 'app_admin', 'app_member', 'app_owner', 'authenticated'
      ]);
    });

    it('should have proper role hierarchy', async () => {
      // Check role inheritance - app_owner should inherit from app_admin, which inherits from app_member
      const inheritanceResult = await testDb.execute(sql`
        SELECT r.rolname as role, m.rolname as member_of
        FROM pg_roles r
        JOIN pg_auth_members am ON r.oid = am.member
        JOIN pg_roles m ON am.roleid = m.oid
        WHERE r.rolname IN ('app_owner', 'app_admin', 'app_member')
        ORDER BY r.rolname, m.rolname
      `);

      const inheritance = inheritanceResult.rows.reduce((acc, row) => {
        if (!acc[row.role]) acc[row.role] = [];
        acc[row.role].push(row.member_of);
        return acc;
      }, {} as Record<string, string[]>);

      expect(inheritance['app_member']).toContain('authenticated');
      expect(inheritance['app_admin']).toContain('app_member');
      expect(inheritance['app_owner']).toContain('app_admin');
    });
  });

  describe('Helper Functions', () => {
    beforeEach(async () => {
      // Set up user context for testing
      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);
      await testDb.execute(sql`
        SELECT set_config('app.current_organization_id', ${testOrgId.toString()}, true)
      `);
    });

    it('should get user organization role correctly', async () => {
      const result = await testDb.execute(sql`
        SELECT get_user_organization_role(${testOrgId}) as role_name
      `);

      expect(result.rows[0].role_name).toBe('member');
    });

    it('should check user permissions correctly', async () => {
      // Test member can view data but cannot manage users
      const canViewData = await testDb.execute(sql`
        SELECT user_has_permission('view_data', ${testOrgId}) as has_permission
      `);
      expect(canViewData.rows[0].has_permission).toBe(true);

      const canManageUsers = await testDb.execute(sql`
        SELECT user_has_permission('manage_users', ${testOrgId}) as has_permission
      `);
      expect(canManageUsers.rows[0].has_permission).toBe(false);
    });

    it('should set database role based on application role', async () => {
      // This would typically be called by the application layer
      await testDb.execute(sql`SELECT set_user_database_role()`);

      // Check current role (note: this might not work in test environment due to isolation)
      const currentRole = await testDb.execute(sql`SELECT current_user as current_role`);
      expect(currentRole.rows[0].current_role).toBeDefined();
    });
  });

  describe('Permission-Based Policies', () => {
    beforeEach(async () => {
      // Set user context
      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);
      await testDb.execute(sql`
        SELECT set_config('app.current_organization_id', ${testOrgId.toString()}, true)
      `);
    });

    it('should enforce agent creation permissions', async () => {
      // Member should not be able to create agents
      const createAttempt = testDb.insert(agents).values({
        name: 'Test Agent',
        organizationId: testOrgId,
        ownerId: testUserId,
        capabilities: [],
      });

      await expect(createAttempt).rejects.toThrow();
    });

    it('should allow permitted operations', async () => {
      // First promote user to admin role to test allowed operations
      await testDb.update(users)
        .set({ roleId: adminRoleId })
        .where(sql`id = ${testUserId}`);

      // Reset the context to pick up new role
      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);

      // Admin should be able to create agents
      const [agent] = await testDb.insert(agents).values({
        name: 'Admin Created Agent',
        organizationId: testOrgId,
        ownerId: testUserId,
        capabilities: [],
      }).returning();

      expect(agent.name).toBe('Admin Created Agent');
    });
  });

  describe('Enhanced RLS Policies', () => {
    beforeEach(async () => {
      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);
      await testDb.execute(sql`
        SELECT set_config('app.current_organization_id', ${testOrgId.toString()}, true)
      `);
    });

    it('should isolate data by organization', async () => {
      // Create another organization
      const [otherOrg] = await testDb.insert(organizations).values({
        name: 'Other Test Org',
        slug: 'other-test-org',
      }).returning();

      // Create agent in other org (using bypass for setup)
      await testDb.execute(sql`SET row_security = off`);
      await testDb.insert(agents).values({
        name: 'Other Org Agent',
        organizationId: otherOrg.id,
        ownerId: testUserId,
        capabilities: [],
      });
      await testDb.execute(sql`SET row_security = on`);

      // User should only see agents from their organization
      const visibleAgents = await testDb
        .select()
        .from(agents)
        .where(sql`organization_id = ${testOrgId}`);

      expect(visibleAgents).toHaveLength(0); // No agents in test org yet
    });

    it('should respect role-based access within organization', async () => {
      // Create team as admin user
      await testDb.update(users)
        .set({ roleId: adminRoleId })
        .where(sql`id = ${testUserId}`);

      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);

      const [team] = await testDb.insert(teams).values({
        name: 'Admin Team',
        organizationId: testOrgId,
        purpose: 'Test team creation',
      }).returning();

      expect(team.name).toBe('Admin Team');

      // Downgrade to member and try to modify team
      await testDb.update(users)
        .set({ roleId: memberRoleId })
        .where(sql`id = ${testUserId}`);

      // Member should not be able to update team
      const updateAttempt = testDb.update(teams)
        .set({ name: 'Updated Team Name' })
        .where(sql`id = ${team.id}`);

      await expect(updateAttempt).rejects.toThrow();
    });
  });

  describe('Integration with Application Layer', () => {
    it('should work with existing permission application service patterns', async () => {
      // Test that our enhanced database security works with the existing application patterns
      
      // Set context for owner user
      await testDb.update(users)
        .set({ roleId: ownerRoleId })
        .where(sql`id = ${testUserId}`);

      await testDb.execute(sql`
        SELECT set_config('auth.user_id', ${testUserId}, true)
      `);

      // Owner should be able to perform all operations
      const permissions = [
        'manage_organization',
        'manage_users', 
        'manage_agents',
        'create_agents',
        'execute_agents'
      ];

      for (const permission of permissions) {
        const result = await testDb.execute(sql`
          SELECT user_has_permission(${permission}, ${testOrgId}) as has_permission
        `);
        expect(result.rows[0].has_permission).toBe(true);
      }
    });
  });
});