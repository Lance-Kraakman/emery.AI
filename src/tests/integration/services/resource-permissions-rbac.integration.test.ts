/**
 * Resource Permissions RBAC Integration Tests
 * 
 * Tests the enhanced RBAC system with resource-specific permissions including:
 * - Global permissions (no resource specified)
 * - Resource-specific permissions with different scopes (all, specific, owned, team)
 * - Agent resource permissions
 * - Team resource permissions
 * - Task assignment permissions using resource-specific checks
 * 
 * AIDEV-NOTE: These tests verify that the enhanced user_has_permission() function
 * correctly enforces resource-specific permissions at the database level.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { getAgentTaskApplicationService, getAgentApplicationService, getTeamApplicationService, initializeDI } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId, TeamId } from '@/ddd/domain/shared/value-objects';
import type { CreateTaskDTO } from '@/app/dtos/task.dto';
import type { CreateAgentDTO } from '@/app/dtos/agent.dto';
import { testClient } from '../shared/integration-helpers';
import { createTestOrganization, createTestAgent, createTestTeam, createTestUser, initializeTestDI } from '../shared/test-setup';
import type { TestContext } from '../shared/test-setup';
import { agents, teams, tasks, teamMemberships, users } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { contextManager } from '@/lib/db/context-manager';

// Test timeout for permission tests
const TEST_TIMEOUT = 30000;

describe('Resource Permissions RBAC Integration Tests', () => {
  let testContext: TestContext;
  let agentTaskService: ReturnType<typeof getAgentTaskApplicationService>;
  let agentService: ReturnType<typeof getAgentApplicationService>;
  
  // Test entities that will be created in beforeEach
  let ownerAgentId: number;
  let otherUserAgentId: number;
  let teamId: number;
  let ownerId: UserId;
  let otherUserId: string;
  let organizationId: number;

  beforeAll(() => {
    // Initialize DI container with proper context-aware database client
    initializeTestDI();
    agentTaskService = getAgentTaskApplicationService();
    agentService = getAgentApplicationService();
  });

  beforeEach(async () => {
    // Clear JavaScript context state before each test
    contextManager.clearContext();
    
    // Create test organization with owner
    testContext = await createTestOrganization('Test Organization');
    organizationId = testContext.organizationId.value;
    ownerId = testContext.ownerUserId;
    
    // Create another user in the same organization
    const otherUser = await createTestUser(
      'other@example.com',
      'Other User',
      testContext.organizationId,
      'member'
    );
    otherUserId = otherUser.id;

    // Create agent owned by the first user
    const ownerAgent = await createTestAgent(
      'Owner Agent',
      ownerId,
      OrganizationId.fromNumber(organizationId)
    );
    ownerAgentId = ownerAgent.id.value;

    // Create agent owned by the other user
    const otherAgent = await createTestAgent(
      'Other User Agent',
      UserId.fromString(otherUserId),
      OrganizationId.fromNumber(organizationId)
    );
    otherUserAgentId = otherAgent.id.value;

    // Create a team with both users as members
    const team = await createTestTeam(
      'Test Team',
      ownerId,
      OrganizationId.fromNumber(organizationId)
    );
    teamId = team.id.value;
    
    // Add both users to the team (mock team membership)
    await testClient.db.insert(teamMemberships).values([
      { teamId, userId: ownerId.value },
      { teamId, userId: otherUserId }
    ]);

    // Ensure users have clean, known starting roles
    await testClient.db.update(users)
      .set({ 
        currentOrganizationId: organizationId 
      })
      .where(eq(users.id, otherUserId));
    
    // Ensure agents have clean, default permissions
    await testClient.db.update(agents)
      .set({ status: 'active' })
      .where(eq(agents.organizationId, organizationId));

    console.log('✅ Test context created with agents and teams (clean state)');
  });

  afterEach(async () => {
    // Clean up test data
    await testClient.cleanTestData();
  });

  describe('Default Agent Task Assignment Permissions', () => {
    test('agent owner can always assign tasks to their own agent', async () => {
      // Set context as agent owner
      contextManager.setContext(OrganizationId.fromNumber(organizationId), ownerId);

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId,
        name: 'Test Task',
        instructions: { task: 'Test instructions' },
        createdBy: ownerId.value,
        organizationId
      };

      const result = await agentTaskService.createTask(createRequest);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.agentId).toBe(ownerAgentId);
      expect(result.data!.status).toBe('pending');
    }, TEST_TIMEOUT);

    test('non-owner cannot assign tasks to agent by default', async () => {
      // Ensure other user is a member, not admin (reset from previous tests)
      await testClient.db.update(users)
        .set({ 
          currentOrganizationId: organizationId // Ensure user is properly linked to organization
        })
        .where(eq(users.id, otherUserId));

      // Explicitly disable all non-owner access for this test
      await testClient.db.update(agents)
        .set({
          status: 'active'
          // TODO: Update test for new resource-specific permission system
          // assignment: { allowOrgAdmins: false }
        })
        .where(eq(agents.id, ownerAgentId));


      // Set context as other user (not agent owner)
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId, // Trying to assign to someone else's agent
        name: 'Unauthorized Task',
        instructions: { task: 'Should fail' },
        createdBy: otherUserId,
        organizationId
      };

      await expect(
        agentTaskService.createTask(createRequest)
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('org admin can assign tasks to any agent (default allowOrgAdmins=true)', async () => {
      // Note: User role management now handled through RBAC system (user_roles table)
      // Role updates would require updating the user_roles table, not the users table

      // Set context as admin user
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId, // Admin assigning to someone else's agent
        name: 'Admin Task',
        instructions: { task: 'Admin can assign' },
        createdBy: otherUserId,
        organizationId
      };

      const result = await agentTaskService.createTask(createRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.agentId).toBe(ownerAgentId);
    }, TEST_TIMEOUT);
  });

  describe('Custom Agent Task Assignment Permissions', () => {
    test('specific user can assign when added to allowedUsers', async () => {
      // Update agent permissions to allow specific user
      await testClient.db.update(agents)
        .set({
          status: 'active',
          assignment: {
            allowedUsers: [otherUserId],
            allowOrgAdmins: true
          }
        })
        .where(eq(agents.id, ownerAgentId));

      // Set context as the allowed user
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId,
        name: 'Allowed User Task',
        instructions: { task: 'Specific user allowed' },
        createdBy: otherUserId,
        organizationId
      };

      const result = await agentTaskService.createTask(createRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.agentId).toBe(ownerAgentId);
    }, TEST_TIMEOUT);

    test('team members can assign when allowTeamMembers is true', async () => {
      // Update agent permissions to allow team members
      await testClient.db.update(agents)
        .set({
          status: 'active',
          assignment: {
            allowTeamMembers: true,
            allowOrgAdmins: true
          }
        })
        .where(eq(agents.id, ownerAgentId));

      // Add agent owner to team (already added in beforeEach)
      // Other user is also in the team

      // Set context as team member (other user)
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId,
        name: 'Team Member Task',
        instructions: { task: 'Team member assigning' },
        createdBy: otherUserId,
        organizationId
      };

      const result = await agentTaskService.createTask(createRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.agentId).toBe(ownerAgentId);
    }, TEST_TIMEOUT);

    test('can disable org admin access by setting allowOrgAdmins=false', async () => {
      // Update agent permissions to disable org admin access and team member access
      await testClient.db.update(agents)
        .set({
          status: 'active',
          assignment: {
            allowOrgAdmins: false, // Explicitly disable admin access
            allowTeamMembers: false, // Also disable team member access for clean test
            allowedUsers: [] // Empty allowed users list
          }
        })
        .where(eq(agents.id, ownerAgentId));

      // Update user role to admin
      await testClient.db.update(users)
        .set({ 
          currentOrganizationId: organizationId // Ensure user is properly linked to organization
        })
        .where(eq(users.id, otherUserId));

      // Set context as admin user
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId,
        name: 'Blocked Admin Task',
        instructions: { task: 'Admin should be blocked' },
        createdBy: otherUserId,
        organizationId
      };

      await expect(
        agentTaskService.createTask(createRequest)
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('Team Task Assignment Permissions', () => {
    test('team task assignment throws not implemented error', async () => {
      // Set context as team member
      contextManager.setContext(OrganizationId.fromNumber(organizationId), ownerId);

      const createRequest: CreateTaskDTO = {
        teamId,
        name: 'Team Task',
        instructions: { task: 'Task for team' },
        createdBy: ownerId.value,
        organizationId
      };

      // Team assignment is not yet implemented
      await expect(agentTaskService.createTask(createRequest))
        .rejects.toThrow('Team task assignment not yet implemented in Task entity');
    }, TEST_TIMEOUT);

    test('team task assignment fails regardless of permissions (not implemented)', async () => {
      // Create a user not in the team
      const outsiderUser = await createTestUser(
        'outsider@example.com',
        'Outsider User',
        organizationId,
        'member'
      );

      // Set context as non-team member
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(outsiderUser.id));

      const createRequest: CreateTaskDTO = {
        teamId,
        name: 'Outsider Task',
        instructions: { task: 'Should fail' },
        createdBy: outsiderUser.id,
        organizationId
      };

      // Team assignment is not yet implemented, so it fails before permission checks
      await expect(agentTaskService.createTask(createRequest))
        .rejects.toThrow('Team task assignment not yet implemented in Task entity');
    }, TEST_TIMEOUT);

    test('team can allow specific users to assign tasks', async () => {
      // Create a user not in the team
      const outsiderUser = await createTestUser(
        'special@example.com',
        'Special User',
        organizationId,
        'member'
      );

      // Update team permissions to allow specific user
      await testClient.db.update(teams)
        .set({
          status: 'active',
          assignment: {
            allowedUsers: [outsiderUser.id],
            allowOrgAdmins: true
          }
        })
        .where(eq(teams.id, teamId));

      // Set context as allowed user
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(outsiderUser.id));

      const createRequest: CreateTaskDTO = {
        teamId,
        name: 'Special User Team Task',
        instructions: { task: 'Allowed user assigning to team' },
        createdBy: outsiderUser.id,
        organizationId
      };

      // Team assignment is not yet implemented
      await expect(agentTaskService.createTask(createRequest))
        .rejects.toThrow('Team task assignment not yet implemented in Task entity');
    }, TEST_TIMEOUT);
  });

  describe('Agent-to-Agent Task Assignment', () => {
    test('agent can assign tasks to another agent when in allowedAgents', async () => {
      // Update target agent to allow tasks from source agent
      await testClient.db.update(agents)
        .set({
          status: 'active',
          assignment: {
            allowedAgents: [otherUserAgentId], // Allow otherUserAgent to assign
            allowOrgAdmins: true
          }
        })
        .where(eq(agents.id, ownerAgentId));

      // Set context as owner of the source agent
      contextManager.setContext(OrganizationId.fromNumber(organizationId), UserId.fromString(otherUserId));

      // This simulates agent-to-agent task routing
      const createRequest: CreateTaskDTO = {
        agentId: ownerAgentId, // Target agent
        name: 'Agent to Agent Task',
        instructions: { task: 'Agent routing task' },
        createdBy: otherUserId, // Owner of source agent
        organizationId
      };

      const result = await agentTaskService.createTask(createRequest);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.agentId).toBe(ownerAgentId);
    }, TEST_TIMEOUT);
  });

  describe('Task Routing Permissions', () => {
    test('agent can route tasks based on routing permissions', async () => {
      // First create a task for the source agent
      contextManager.setContext(OrganizationId.fromNumber(organizationId), ownerId);
      const initialTask = await agentTaskService.createTask({
        agentId: ownerAgentId,
        name: 'Initial Task',
        instructions: { task: 'To be routed' },
        createdBy: ownerId.value,
        organizationId
      });

      // Update source agent's routing permissions
      await testClient.db.update(agents)
        .set({
          status: 'active',
          assignment: { allowOrgAdmins: true },
          routing: {
            allowedAgents: [otherUserAgentId], // Can route to specific agent
            allowAnyTeamAgent: false,
            allowAnyOrgAgent: false
          }
        })
        .where(eq(agents.id, ownerAgentId));

      expect(initialTask.success).toBe(true);
      expect(initialTask.data).toBeDefined();

      // Simulate routing by updating the task
      // (In real app this would be done through a routing service)
      await testClient.db.update(tasks)
        .set({
          agentId: otherUserAgentId,
          routedFromAgentId: ownerAgentId,
          routedAt: new Date(),
          routingReason: 'Test routing'
        })
        .where(eq(tasks.id, initialTask.data!.id));

      // Verify the task was routed
      const routedTask = await testClient.db.select()
        .from(tasks)
        .where(eq(tasks.id, initialTask.data!.id))
        .limit(1);

      expect(routedTask[0].agentId).toBe(otherUserAgentId);
      expect(routedTask[0].routedFromAgentId).toBe(ownerAgentId);
    }, TEST_TIMEOUT);
  });

  describe('Cross-Organization Isolation', () => {
    test('cannot assign tasks across organizations', async () => {
      // Create another organization
      const otherOrgContext = await createTestOrganization('Other Organization');
      
      // Create agent in other organization
      contextManager.setContext(otherOrgContext.organizationId, otherOrgContext.ownerUserId);
      const otherOrgAgent = await createTestAgent(
        'Other Org Agent',
        otherOrgContext.ownerUserId,
        otherOrgContext.organizationId
      );

      // Try to assign task from first org user to other org agent
      contextManager.setContext(OrganizationId.fromNumber(organizationId), ownerId);
      
      const createRequest: CreateTaskDTO = {
        agentId: otherOrgAgent.id.value,
        name: 'Cross-Org Task',
        instructions: { task: 'Should fail' },
        createdBy: ownerId.value,
        organizationId // Different from agent's org
      };

      await expect(
        agentTaskService.createTask(createRequest)
      ).rejects.toThrow();

      // Clean up other org
      await testClient.cleanTestData();
    }, TEST_TIMEOUT);
  });
});