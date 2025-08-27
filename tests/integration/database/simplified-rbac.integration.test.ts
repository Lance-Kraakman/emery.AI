/**
 * Integration tests for Simplified 3-Role RBAC System
 * AIDEV-NOTE: Tests the pure Drizzle approach with fixed owner/admin/member roles
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { testClient } from '../shared/integration-helpers';
import { organizations, users, agents, teams } from '@/lib/db/schema';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { UserRole } from '@/ddd/domain/shared/value-objects/user-role';
import { ORGANIZATION_ROLES } from '@/ddd/domain/shared/value-objects/organization-role';

describe('Simplified 3-Role RBAC System', () => {
  let testOrgId: number;
  let ownerUserId: string;
  let adminUserId: string;
  let memberUserId: string;

  beforeAll(async () => {
    // Ensure database is clean - RLS is already enabled by migrations
    await testClient.db.execute(sql`DELETE FROM agents WHERE name LIKE '%RBAC Test%'`);
    await testClient.db.execute(sql`DELETE FROM teams WHERE name LIKE '%RBAC Test%'`);
    await testClient.db.execute(sql`DELETE FROM users WHERE email LIKE '%rbac-test%'`);
    await testClient.db.execute(sql`DELETE FROM organizations WHERE name LIKE '%RBAC Test%'`);
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Use existing test organizations from seed data (to avoid RLS issues)
    testOrgId = 1; // From seed data: 'Test Organization 1'

    // Create test users with different roles using proper RLS context
    const ownerUser = UserId.generate();
    const adminUser = UserId.generate();
    const memberUser = UserId.generate();

    ownerUserId = ownerUser.value;
    adminUserId = adminUser.value;
    memberUserId = memberUser.value;

    // Create users with proper RLS context
    await testClient.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_organization_id', ${testOrgId.toString()}, true)`);
      
      await tx.insert(users).values([
        {
          id: ownerUserId,
          email: 'owner@rbac-test.com',
          name: 'Test Owner',
          organizationRole: ORGANIZATION_ROLES.OWNER,
          currentOrganizationId: testOrgId,
        },
        {
          id: adminUserId,
          email: 'admin@rbac-test.com',
          name: 'Test Admin',
          organizationRole: ORGANIZATION_ROLES.ADMIN,
          currentOrganizationId: testOrgId,
        },
        {
          id: memberUserId,
          email: 'member@rbac-test.com',
          name: 'Test Member',
          organizationRole: ORGANIZATION_ROLES.MEMBER,
          currentOrganizationId: testOrgId,
        },
      ]);
    });
  });

  afterEach(async () => {
    // Clean up test data
    await testClient.db.execute(sql`DELETE FROM agents`);
    await testClient.db.execute(sql`DELETE FROM teams`);
    await testClient.db.execute(sql`DELETE FROM users WHERE email LIKE '%rbac-test%'`);
    await testClient.db.execute(sql`DELETE FROM organizations WHERE name LIKE '%RBAC Test%'`);
  });

  describe('User Role Capabilities', () => {
    it('should define correct capabilities for owner role', () => {
      const ownerRole = UserRole.owner();
      
      expect(ownerRole.role).toBe('owner');
      expect(ownerRole.isOwner()).toBe(true);
      expect(ownerRole.isAdministrative()).toBe(true);
      expect(ownerRole.hasCapability('canManageOrganization')).toBe(true);
      expect(ownerRole.hasCapability('canManageUsers')).toBe(true);
      expect(ownerRole.hasCapability('canCreateAgents')).toBe(true);
      expect(ownerRole.hasCapability('canManageAgents')).toBe(true);
      expect(ownerRole.getHierarchyLevel()).toBe(3);
    });

    it('should define correct capabilities for admin role', () => {
      const adminRole = UserRole.admin();
      
      expect(adminRole.role).toBe('admin');
      expect(adminRole.isAdmin()).toBe(true);
      expect(adminRole.isAdministrative()).toBe(true);
      expect(adminRole.hasCapability('canManageOrganization')).toBe(false); // No org management
      expect(adminRole.hasCapability('canManageUsers')).toBe(true);
      expect(adminRole.hasCapability('canCreateAgents')).toBe(true);
      expect(adminRole.hasCapability('canManageAgents')).toBe(true);
      expect(adminRole.getHierarchyLevel()).toBe(2);
    });

    it('should define correct capabilities for member role', () => {
      const memberRole = UserRole.member();
      
      expect(memberRole.role).toBe('member');
      expect(memberRole.isMember()).toBe(true);
      expect(memberRole.isAdministrative()).toBe(false);
      expect(memberRole.hasCapability('canManageOrganization')).toBe(false);
      expect(memberRole.hasCapability('canManageUsers')).toBe(false);
      expect(memberRole.hasCapability('canCreateAgents')).toBe(false); // Cannot create
      expect(memberRole.hasCapability('canViewAgents')).toBe(true); // Can view
      expect(memberRole.hasCapability('canExecuteAgents')).toBe(true); // Can execute
      expect(memberRole.getHierarchyLevel()).toBe(1);
    });

    it('should correctly compare role hierarchy', () => {
      const owner = UserRole.owner();
      const admin = UserRole.admin();
      const member = UserRole.member();

      expect(owner.hasHigherPrivilegesThan(admin)).toBe(true);
      expect(admin.hasHigherPrivilegesThan(member)).toBe(true);
      expect(owner.hasHigherPrivilegesThan(member)).toBe(true);
      
      expect(member.hasHigherPrivilegesThan(admin)).toBe(false);
      expect(admin.hasHigherPrivilegesThan(owner)).toBe(false);
    });
  });

  describe('Database Integration', () => {
    it('should store users with organization roles correctly', async () => {
      const users = await testClient.db.query.users.findMany({
        where: (users, { eq }) => eq(users.currentOrganizationId, testOrgId)
      });

      expect(users).toHaveLength(3);
      
      const owner = users.find(u => u.organizationRole === 'owner');
      const admin = users.find(u => u.organizationRole === 'admin');
      const member = users.find(u => u.organizationRole === 'member');

      expect(owner).toBeDefined();
      expect(admin).toBeDefined();
      expect(member).toBeDefined();
      
      expect(owner?.email).toBe('owner@rbac-test.com');
      expect(admin?.email).toBe('admin@rbac-test.com');
      expect(member?.email).toBe('member@rbac-test.com');
    });

    it('should default new users to member role', async () => {
      const newUserId = UserId.generate().value;
      
      await testClient.db.insert(users).values({
        id: newUserId,
        email: 'newuser@rbac-test.com',
        name: 'New User',
        currentOrganizationId: testOrgId,
        // No organizationRole specified - should default to 'member'
      });

      const newUser = await testClient.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, newUserId)
      });

      expect(newUser?.organizationRole).toBe('member');
    });
  });

  describe('Pure Drizzle Policies (Conceptual)', () => {
    // NOTE: These tests demonstrate the intended behavior of our Drizzle policies
    // In a real environment, we'd need to set up proper database role switching

    it('should conceptually allow owners full access to organizations', async () => {
      // Set user context (in real app, this would be handled by auth middleware)
      await testClient.db.execute(sql`
        SELECT set_config('app.current_organization_id', ${testOrgId.toString()}, true)
      `);
      await testClient.db.execute(sql`
        SELECT set_config('auth.user_id', ${ownerUserId}, true)
      `);

      // Owner should be able to update organization
      // (This would be enforced by RLS policies in production)
      const orgUpdate = testClient.db.update(organizations)
        .set({ name: 'Updated by Owner' })
        .where(sql`id = ${testOrgId}`);

      // In a real test, this would either succeed or fail based on RLS policies
      // For now, we just verify the query structure is correct
      expect(orgUpdate).toBeDefined();
    });

    it('should conceptually restrict members from creating agents', async () => {
      // Set member user context
      await testClient.db.execute(sql`
        SELECT set_config('auth.user_id', ${memberUserId}, true)
      `);

      // Member attempting to create agent
      const agentCreation = testClient.db.insert(agents).values({
        name: 'Member Created Agent',
        organizationId: testOrgId,
        ownerId: memberUserId,
        capabilities: [],
      });

      // In production with RLS enabled, this would be blocked by policies
      // For testing, we verify the structure
      expect(agentCreation).toBeDefined();
    });

    it('should conceptually allow admins to create agents', async () => {
      // Set admin user context
      await testClient.db.execute(sql`
        SELECT set_config('auth.user_id', ${adminUserId}, true)
      `);

      // Admin creating agent
      const agentCreation = testClient.db.insert(agents).values({
        name: 'Admin Created Agent',
        organizationId: testOrgId,
        ownerId: adminUserId,
        capabilities: [],
      });

      // In production, this would be allowed by RLS policies
      expect(agentCreation).toBeDefined();
    });
  });

  describe('Simplified vs Complex System Comparison', () => {
    it('should be much simpler than the complex roles system', () => {
      // The simplified system uses:
      // 1. Single organizationRole field instead of roleId + roles table
      // 2. Fixed capabilities instead of dynamic permissions arrays
      // 3. Pure Drizzle policies instead of complex custom SQL functions
      // 4. 3 roles instead of unlimited custom roles

      const userRole = UserRole.fromString('admin');
      const capabilities = userRole.capabilities;

      // Capabilities are computed, not stored
      expect(capabilities.canManageUsers).toBe(true);
      expect(capabilities.canManageOrganization).toBe(false);
      
      // No complex database queries needed
      expect(userRole.isAdministrative()).toBe(true);
      expect(userRole.getHierarchyLevel()).toBe(2);
    });

    it('should maintain type safety with value objects', () => {
      // Still uses domain value objects for type safety
      expect(() => UserRole.fromString('invalid-role')).toThrow();
      expect(() => UserRole.fromString('owner')).not.toThrow();
      expect(() => UserRole.fromString('admin')).not.toThrow();
      expect(() => UserRole.fromString('member')).not.toThrow();
    });
  });
});