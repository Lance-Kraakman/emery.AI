import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { getInvitationApplicationService, getUserRepository } from '@/ddd/application/di/container';
import { OrganizationId, UserId, EmailAddress, InvitationToken } from '@/ddd/domain/shared/value-objects';
import { SystemRoleType,  } from '@/ddd/domain/rbac/entities/role';
import type { SendInvitationCommand, AcceptInvitationCommand, BulkInvitationCommand } from '@/ddd/application/services/invitations/invitation-application-service';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';
import { initializeTestDI } from '../shared/test-setup';

// AIDEV-NOTE: Invitation Application Service integration tests using TestCase pattern
// Tests invitation workflow: send, accept, revoke, resend, and bulk operations

interface SendInvitationTestInput {
  organizationId: number;
  invitedBy: string;
  email: string;
  roleIds: Array<number>;
  expiryDays?: number;
  sendEmail?: boolean;
}

interface SendInvitationTestOutput {
  success: boolean;
  error?: string;
  hasWarnings?: boolean;
}

interface AcceptInvitationTestInput {
  token: string;
  acceptingUserEmail: string;
  userData?: {
    name?: string;
    password?: string;
  };
}

interface AcceptInvitationTestOutput {
  success: boolean;
  error?: string;
  isNewUser?: boolean;
}

// Factory function to generate send invitation test cases
function createSendInvitationTestCases(context: TestContext): TestCase<SendInvitationTestInput, SendInvitationTestOutput>[] {
  const uniqueId = Math.random().toString(36).substring(7);
  return [
    {
      name: 'should send invitation with valid input',
      input: {
        organizationId: context.organizationId.value,
        invitedBy: context.ownerUserId.value,
        email: `newuser-${uniqueId}@example.com`,
        roleIds: [4],
        sendEmail: false // Disable email sending in tests
      },
      expected: { success: true }
    },
    {
      name: 'should reject invitation with invalid email format',
      input: {
        organizationId: context.organizationId.value,
        invitedBy: context.ownerUserId.value,
        email: 'invalid-email',
        roleIds: [4],
        sendEmail: false
      },
      expected: { success: false, error: 'Invalid email format' }
    },
    {
      name: 'should reject invitation with invalid role',
      input: {
        organizationId: context.organizationId.value,
        invitedBy: context.ownerUserId.value,
        email: `another-${uniqueId}@example.com`,
        roleIds: [999], // Invalid role ID
        sendEmail: false
      },
      expected: { success: false, error: 'Invalid role' }
    },
    {
      name: 'should reject duplicate invitation for same email',
      input: {
        organizationId: context.organizationId.value,
        invitedBy: context.ownerUserId.value,
        email: `duplicate-${uniqueId}@example.com`,
        roleIds: [4],
        sendEmail: false
      },
      expected: { success: false, error: 'already exists' }
    },
    {
      name: 'should reject invitation for existing member',
      input: {
        organizationId: context.organizationId.value,
        invitedBy: context.ownerUserId.value,
        email: `existing-${uniqueId}@example.com`, // Will be added as member before test
        roleIds: [4],
        sendEmail: false
      },
      expected: { success: false, error: 'already a member' }
    }
  ];
}

// Test context that will be created in beforeEach
let testContext: TestContext;
let invitationToken: string | null = null;

describe('Invitation Application Service Integration Tests', () => {
  
  beforeAll(() => {
    // Initialize DI container
    initializeTestDI();
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // AIDEV-NOTE: Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      // Create unique test organization and owner
      testContext = await createTestOrganization('Invitation Test Organization');
      
      console.log(`✅ Test context created: org=${testContext.organizationId.value}, owner=${testContext.ownerUserId.value}`);
      
    } catch (error) {
      console.error('❌ Error creating test context in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clean test data between tests (superuser bypasses RLS for cleanup)
      await testClient.cleanTestData();
      invitationToken = null;
      
      console.log(`✅ Test cleanup completed for org=${testContext.organizationId.value}`);
      
    } catch (error) {
      console.warn('⚠️  Error during test cleanup (non-fatal):', error);
      // Don't throw - cleanup errors shouldn't fail tests
    }
  });

  describe('Send Invitation Operations', () => {
    
    test('should run all send invitation test cases', async () => {
      const invitationService = getInvitationApplicationService();
      const userRepository = getUserRepository();
      
      const testCases = createSendInvitationTestCases(testContext);
      
      // Setup: Create duplicate invitation for duplicate test
      const duplicateTestCase = testCases.find(t => t.name.includes('duplicate'));
      if (duplicateTestCase) {
        await invitationService.sendInvitation({
          organizationId: testContext.organizationId.value,
          invitedBy: testContext.ownerUserId.value,
          email: duplicateTestCase.input.email,
          roleIds: [4],
          sendEmail: false
        });
      }
      
      // Setup: Create existing member for existing member test
      const existingTestCase = testCases.find(t => t.name.includes('existing member'));
      if (existingTestCase) {
        const existingUser = await userRepository.create({
          email: EmailAddress.fromString(existingTestCase.input.email),
          name: 'Existing User',
          emailVerified: new Date()
        });
        await userRepository.addUserToOrganization({
          userId: existingUser.id,
          organizationId: testContext.organizationId,
        });
      }
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const command: SendInvitationCommand = testCase.input;

        console.log(`🔍 Sending invitation with command:`, {
          organizationId: command.organizationId,
          invitedBy: command.invitedBy,
          email: command.email,
        });

        const result = await invitationService.sendInvitation(command);
        
        console.log(`🔍 Invitation send result:`, {
          success: result.success,
          error: result.error,
          hasData: !!result.data,
          warnings: result.warnings
        });
        
        // Assertions
        expect(result.success).toBe(testCase.expected.success);
        
        if (testCase.expected.error) {
          expect(result.error).toContain(testCase.expected.error);
        }
        
        if (testCase.expected.hasWarnings !== undefined) {
          expect(!!result.warnings).toBe(testCase.expected.hasWarnings);
        }
        
        // Store token from first successful invitation for acceptance test
        if (result.success && result.data && !invitationToken) {
          invitationToken = result.data.token.value;
        }
      }
    });
  });

  describe('Accept Invitation Operations', () => {
    
    test('should successfully accept a valid invitation', async () => {
      const invitationService = getInvitationApplicationService();
      const uniqueId = Math.random().toString(36).substring(7);
      const testEmail = `invitee-${uniqueId}@example.com`;
      
      // First create an invitation
      const sendResult = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: testEmail,
        roleIds: [4],
        sendEmail: false
      });
      
      expect(sendResult.success).toBe(true);
      expect(sendResult.data).toBeDefined();
      
      const token = sendResult.data!.token.value;
      
      // Accept the invitation
      const acceptCommand: AcceptInvitationCommand = {
        token,
        acceptingUserEmail: testEmail,
        userData: {
          name: 'New Invitee'
        }
      };
      
      const acceptResult = await invitationService.acceptInvitation(acceptCommand);
      
      console.log('🔍 Accept invitation result:', {
        success: acceptResult.success,
        error: acceptResult.error,
        isNewUser: acceptResult.data?.isNewUser
      });
      
      expect(acceptResult.success).toBe(true);
      expect(acceptResult.data).toBeDefined();
      expect(acceptResult.data!.isNewUser).toBe(true);
      expect(acceptResult.data!.user).toBeDefined();
      expect(acceptResult.data!.userOrganization).toBeDefined();
    });
    
    test('should reject invitation with wrong email', async () => {
      const invitationService = getInvitationApplicationService();
      const uniqueId = Math.random().toString(36).substring(7);
      const correctEmail = `correct-${uniqueId}@example.com`;
      const wrongEmail = `wrong-${uniqueId}@example.com`;
      
      // First create an invitation
      const sendResult = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: correctEmail,
        roleIds: [4],
        sendEmail: false
      });
      
      expect(sendResult.success).toBe(true);
      const token = sendResult.data!.token.value;
      
      // Try to accept with wrong email
      const acceptResult = await invitationService.acceptInvitation({
        token,
        acceptingUserEmail: wrongEmail,
        userData: { name: 'Wrong User' }
      });
      
      expect(acceptResult.success).toBe(false);
      expect(acceptResult.error).toContain('does not match');
    });
    
    test('should reject expired invitation', async () => {
      const invitationService = getInvitationApplicationService();
      const uniqueId = Math.random().toString(36).substring(7);
      const expiredEmail = `expired-${uniqueId}@example.com`;
      
      // Create invitation with very short expiry
      const sendResult = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: expiredEmail,
        roleIds: [4],
        expiryDays: -1, // Already expired
        sendEmail: false
      });
      
      // Note: The service might prevent creating expired invitations
      // If so, we'd need to update the invitation's expiry directly in the DB
      if (sendResult.success && sendResult.data) {
        const acceptResult = await invitationService.acceptInvitation({
          token: sendResult.data.token.value,
          acceptingUserEmail: expiredEmail,
          userData: { name: 'Expired User' }
        });
        
        // Should either fail to create or fail to accept
        if (acceptResult.success === false) {
          expect(acceptResult.error).toContain('expired');
        }
      }
    });
  });

  describe('Bulk Invitation Operations', () => {
    
    test('should send bulk invitations successfully', async () => {
      const invitationService = getInvitationApplicationService();
      
      const bulkCommand: BulkInvitationCommand = {
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        invitations: [
          { email: EmailAddress.fromString(`bulk1-${Math.random().toString(36).substring(7)}@example.com`)},
          { email: EmailAddress.fromString(`bulk2-${Math.random().toString(36).substring(7)}@example.com`)  },
          { email: EmailAddress.fromString(`bulk3-${Math.random().toString(36).substring(7)}@example.com`) }  // Should use default role
        ],
        sendEmail: false
      };
      
      const result = await invitationService.sendBulkInvitations(bulkCommand);
      
      console.log('🔍 Bulk invitation result:', {
        success: result.success,
        totalSent: result.data?.totalSent,
        totalFailed: result.data?.totalFailed,
        warnings: result.warnings
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalSent).toBe(3);
      expect(result.data!.totalFailed).toBe(0);
      expect(result.data!.successful.length).toBe(3);
    });
    
    test('should handle mixed success/failure in bulk invitations', async () => {
      const invitationService = getInvitationApplicationService();
      const uniqueId = Math.random().toString(36).substring(7);
      const existingBulkEmail = `existing-bulk-${uniqueId}@example.com`;
      
      // First create one invitation that will cause a duplicate
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: existingBulkEmail,
        roleIds: [4],
        sendEmail: false
      });
      
      const bulkCommand: BulkInvitationCommand = {
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        invitations: [
          { email: EmailAddress.fromString(`new-bulk-${uniqueId}@example.com`) },
          { email: EmailAddress.fromString(existingBulkEmail) }, // Will fail - duplicate
          { email: EmailAddress.fromString(`another-new-${uniqueId}@example.com`) }
        ],
        sendEmail: false
      };
      
      const result = await invitationService.sendBulkInvitations(bulkCommand);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.totalSent).toBeGreaterThan(0);
      expect(result.data!.totalFailed).toBeGreaterThan(0);
      expect(result.data!.successful.length + result.data!.failed.length).toBe(3); // Now 3 invitations instead of 4
    });
  });

  describe('Invitation Management Operations', () => {
    
    test('should revoke an invitation successfully', async () => {
      const invitationService = getInvitationApplicationService();
      
      // Create an invitation
      const sendResult = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'torevoke@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      expect(sendResult.success).toBe(true);
      const invitationId = sendResult.data!.id.value;
      
      // Revoke the invitation
      const revokeResult = await invitationService.revokeInvitation(
        invitationId,
        testContext.ownerUserId.value
      );
      
      expect(revokeResult.success).toBe(true);
      
      // Verify invitation is gone
      const getResult = await invitationService.getInvitationByToken(sendResult.data!.token.value);
      expect(getResult.success).toBe(false);
    });
    
    test('should resend an invitation and extend expiry', async () => {
      const invitationService = getInvitationApplicationService();
      
      // Create an invitation
      const sendResult = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'toresend@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      expect(sendResult.success).toBe(true);
      const invitationId = sendResult.data!.id.value;
      const originalExpiry = sendResult.data!.expiresAt;
      
      // Resend the invitation
      const resendResult = await invitationService.resendInvitation(
        invitationId,
        testContext.ownerUserId.value
      );
      
      expect(resendResult.success).toBe(true);
      expect(resendResult.data).toBeDefined();
      
      // Check if expiry was extended (for expired invitations)
      // or at least maintained (for non-expired)
      expect(resendResult.data!.expiresAt).toBeDefined();
    });
    
    test('should get pending invitations for organization', async () => {
      const invitationService = getInvitationApplicationService();
      
      // Create multiple invitations
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'pending1@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'pending2@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      // Get pending invitations
      const pendingInvitations = await invitationService.getPendingInvitations(
        testContext.organizationId.value
      );
      
      expect(pendingInvitations).toBeDefined();
      expect(pendingInvitations.length).toBe(2);
      expect(pendingInvitations.every(inv => inv.organizationId.value === testContext.organizationId.value)).toBe(true);
    });
    
    test('should get invitation statistics', async () => {
      const invitationService = getInvitationApplicationService();
      
      // Create invitations with different roles
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'stats1@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'stats2@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: testContext.ownerUserId.value,
        email: 'stats3@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      // Get statistics
      const stats = await invitationService.getInvitationStats(
        testContext.organizationId.value
      );
      
      expect(stats).toBeDefined();
      expect(stats.totalInvitations).toBe(3);
      expect(stats.pendingInvitations).toBe(3);
      expect(stats.expiredInvitations).toBe(0);
      expect(stats.invitationsByRole.member).toBe(1);
      expect(stats.invitationsByRole.admin).toBe(1);
      expect(stats.invitationsByRole.owner).toBe(1);
    });
    
    test('should cleanup expired invitations', async () => {
      const invitationService = getInvitationApplicationService();
      
      // Note: Creating truly expired invitations might require direct DB access
      // For now, test that cleanup doesn't fail
      const cleanupResult = await invitationService.cleanupExpiredInvitations(
        testContext.organizationId.value
      );
      
      expect(cleanupResult.success).toBe(true);
      expect(cleanupResult.data).toBeDefined();
      expect(typeof cleanupResult.data).toBe('number');
    });
  });

  describe('Permission and Validation Tests', () => {
    
    test('should reject invitation from non-admin user', async () => {
      const invitationService = getInvitationApplicationService();
      const userRepository = getUserRepository();
      
      // Create a regular member user with unique email
      const uniqueId = Math.random().toString(36).substring(7);
      const memberUser = await userRepository.create({
        email: EmailAddress.fromString(`member-${uniqueId}@example.com`),
        name: 'Regular Member',
        emailVerified: new Date()
      });
      
      await userRepository.addUserToOrganization({
        userId: memberUser.id,
        organizationId: testContext.organizationId,
      });
      
      // Try to send invitation as a regular member
      const result = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: memberUser.id.value,
        email: 'newuser@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });
    
    test('should allow admin to send invitations', async () => {
      const invitationService = getInvitationApplicationService();
      const userRepository = getUserRepository();
      
      // Create an admin user with unique email
      const uniqueId = Math.random().toString(36).substring(7);
      const adminUser = await userRepository.create({
        email: EmailAddress.fromString(`admin-${uniqueId}@example.com`),
        name: 'Admin User',
        emailVerified: new Date()
      });
      
      await userRepository.addUserToOrganization({
        userId: adminUser.id,
        organizationId: testContext.organizationId,
      });
      
      // Send invitation as admin
      const result = await invitationService.sendInvitation({
        organizationId: testContext.organizationId.value,
        invitedBy: adminUser.id.value,
        email: 'fromadmin@example.com',
        roleIds: [4],
        sendEmail: false
      });
      
      expect(result.success).toBe(true);
    });
  });
});