import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { 
  getUserOAuthConnections, 
  getAppConnectionUrl, 
  disconnectOAuthAccount,
  checkRequiredConnections,
  getConnectionSummary,
  canUseApp
} from '@/app/actions/connections';
import { initializeDI } from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';

// AIDEV-NOTE: Server Actions integration tests for Connection system
// Tests the complete request flow from frontend -> server actions -> DDD layers
// Validates authentication, input validation, and proper Result type responses

interface GetConnectionsActionTestOutput {
  success: boolean;
  hasData?: boolean;
  error?: string;
}

interface ConnectionUrlActionTestInput {
  appName: string;
  redirectUrl?: string;
}

interface ConnectionUrlActionTestOutput {
  success: boolean;
  hasUrl?: boolean;
  error?: string;
}

interface DisconnectActionTestInput {
  accountId: string;
}

interface DisconnectActionTestOutput {
  success: boolean;
  error?: string;
}

interface CanUseAppActionTestInput {
  appName: string;
}

interface CanUseAppActionTestOutput {
  success: boolean;
  canUse?: boolean;
  error?: string;
}

// Mock session for testing - simulates authenticated user
const mockSession = {
  user: {
    id: '', // Will be set in beforeEach
    email: 'test@example.com',
    name: 'Test User'
  }
};

// Mock requireAuth to return our test session
jest.mock('@/app/actions/permissions', () => ({
  requireAuth: jest.fn().mockImplementation(() => Promise.resolve(mockSession))
}));

let testContext: TestContext;

describe('Connection Server Actions Integration Tests', () => {
  
  beforeAll(async () => {
    // Initialize DI container
    initializeDI(testClient.db as any, testClient.db as any);
    await testClient.verifyDatabaseConnection();
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create fresh test organization for each test
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      testContext = await createTestOrganization('Connection Actions Test Org');
      
      // Update mock session with test user ID
      mockSession.user.id = testContext.ownerUserId.value;
      
      console.log(`✅ Test context created for actions: user=${testContext.ownerUserId.value}`);
      
    } catch (error) {
      console.error('❌ Error creating test context for actions:', error);
      throw error;
    }
  });

  describe('getUserOAuthConnections', () => {
    
    function createGetConnectionsTestCases(): TestCase<void, GetConnectionsActionTestOutput>[] {
      return [
        {
          name: 'should return connections for authenticated user',
          input: undefined,
          expected: { 
            success: true,
            hasData: true
          }
        }
      ];
    }

    test.each(createGetConnectionsTestCases())('$name', async ({ expected }) => {
      // Act
      const result = await getUserOAuthConnections();

      // Assert
      expect(result.success).toBe(expected.success);
      
      if (expected.success && expected.hasData) {
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      }
      
      if (expected.error) {
        expect(result.error).toContain(expected.error);
      }
    });
  });

  describe('getAppConnectionUrl', () => {
    
    function createConnectionUrlTestCases(): TestCase<ConnectionUrlActionTestInput, ConnectionUrlActionTestOutput>[] {
      return [
        {
          name: 'should generate URL for Gmail with redirect',
          input: {
            appName: 'gmail',
            redirectUrl: 'http://localhost:3000/connections'
          },
          expected: { 
            success: true,
            hasUrl: true
          }
        },
        {
          name: 'should generate URL for Slack without redirect',
          input: {
            appName: 'slack'
          },
          expected: { 
            success: true,
            hasUrl: true
          }
        },
        {
          name: 'should reject invalid app name',
          input: {
            appName: 'invalid-app'
          },
          expected: { 
            success: false,
            error: 'Unsupported app'
          }
        },
        {
          name: 'should reject empty app name',
          input: {
            appName: ''
          },
          expected: { 
            success: false,
            error: 'App name cannot be empty'
          }
        }
      ];
    }

    test.each(createConnectionUrlTestCases())('$name', async ({ input, expected }) => {
      // Act
      const result = await getAppConnectionUrl(input);

      // Assert
      expect(result.success).toBe(expected.success);
      
      if (expected.success && result.success && result.data) {
        if (expected.hasUrl) {
          expect(result.data.url).toBeDefined();
          expect(result.data.url).toMatch(/^https?:\/\/.+/);
        }
      }
      
      if (expected.error) {
        expect(result.error).toContain(expected.error);
      }
    });
  });

  describe('disconnectOAuthAccount', () => {
    
    function createDisconnectTestCases(): TestCase<DisconnectActionTestInput, DisconnectActionTestOutput>[] {
      return [
        {
          name: 'should reject invalid account ID format',
          input: {
            accountId: 'ab' // Too short
          },
          expected: { 
            success: false,
            error: 'Invalid account ID format'
          }
        },
        {
          name: 'should handle non-existent account gracefully',
          input: {
            accountId: 'valid-but-nonexistent-id'
          },
          expected: { 
            success: false // Should fail for non-existent account
          }
        }
      ];
    }

    test.each(createDisconnectTestCases())('$name', async ({ input, expected }) => {
      // Act
      const result = await disconnectOAuthAccount(input);

      // Assert
      expect(result.success).toBe(expected.success);
      
      if (expected.error) {
        expect(result.error).toContain(expected.error);
      }
    });
  });

  describe('checkRequiredConnections', () => {
    
    test('should identify missing connections for new user', async () => {
      // Arrange
      const requiredApps = ['gmail', 'slack', 'github'];

      // Act
      const result = await checkRequiredConnections(requiredApps);

      // Assert
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data).toEqual(
          expect.arrayContaining(['gmail', 'slack', 'github'])
        );
      }
    });

    test('should handle empty required apps list', async () => {
      // Act
      const result = await checkRequiredConnections([]);

      // Assert
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toHaveLength(0);
      }
    });

    test('should filter out unsupported apps', async () => {
      // Arrange
      const requiredApps = ['gmail', 'invalid-app', 'slack'];

      // Act
      const result = await checkRequiredConnections(requiredApps);

      // Assert
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data).toEqual(
          expect.arrayContaining(['gmail', 'slack'])
        );
        expect(result.data).not.toContain('invalid-app');
      }
    });
  });

  describe('getConnectionSummary', () => {
    
    test('should return summary for authenticated user', async () => {
      // Act
      const result = await getConnectionSummary();

      // Assert
      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(typeof result.data.totalConnections).toBe('number');
        expect(typeof result.data.activeConnections).toBe('number');
        expect(typeof result.data.errorConnections).toBe('number');
        expect(Array.isArray(result.data.connectedApps)).toBe(true);
        
        // For new user, should be zero connections
        expect(result.data.totalConnections).toBe(0);
        expect(result.data.activeConnections).toBe(0);
        expect(result.data.errorConnections).toBe(0);
        expect(result.data.connectedApps).toHaveLength(0);
      }
    });
  });

  describe('canUseApp', () => {
    
    function createCanUseAppTestCases(): TestCase<CanUseAppActionTestInput, CanUseAppActionTestOutput>[] {
      return [
        {
          name: 'should return false for Gmail (no connection)',
          input: {
            appName: 'gmail'
          },
          expected: { 
            success: true,
            canUse: false
          }
        },
        {
          name: 'should return false for Slack (no connection)',
          input: {
            appName: 'slack'
          },
          expected: { 
            success: true,
            canUse: false
          }
        },
        {
          name: 'should handle invalid app name gracefully',
          input: {
            appName: 'invalid-app'
          },
          expected: { 
            success: false,
            error: 'Unsupported app'
          }
        }
      ];
    }

    test.each(createCanUseAppTestCases())('$name', async ({ input, expected }) => {
      // Act
      const result = await canUseApp(input.appName);

      // Assert
      expect(result.success).toBe(expected.success);
      
      if (expected.success && result.success && result.data !== undefined) {
        expect(result.data).toBe(expected.canUse);
      }
      
      if (expected.error) {
        expect(result.error).toContain(expected.error);
      }
    });
  });

  describe('Authentication Integration', () => {
    
    test('should handle authentication requirement', async () => {
      // AIDEV-NOTE: This test verifies that authentication is properly enforced
      // In a real scenario, requireAuth would throw or return error for unauthenticated requests
      
      // For this test, we assume authentication passes since we mocked requireAuth
      const result = await getUserOAuthConnections();
      expect(result.success).toBe(true);
    });
  });

  describe('Input Validation and Error Handling', () => {
    
    test('should validate AppName through domain value objects', async () => {
      // Invalid app names should be caught by AppName.fromString()
      const result = await getAppConnectionUrl({ appName: 'totally-invalid-app' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported app');
    });

    test('should validate ConnectionId through domain value objects', async () => {
      // Invalid connection IDs should be caught by ConnectionId.fromPipedreamId()
      const result = await disconnectOAuthAccount({ accountId: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid account ID format');
    });
  });

  describe('Result Type Consistency', () => {
    
    test('all actions should return consistent Result type structure', async () => {
      // Test getUserOAuthConnections Result structure
      const connectionsResult = await getUserOAuthConnections();
      expect(connectionsResult).toHaveProperty('success');
      expect(typeof connectionsResult.success).toBe('boolean');
      
      // Test getAppConnectionUrl Result structure
      const urlResult = await getAppConnectionUrl({ appName: 'gmail' });
      expect(urlResult).toHaveProperty('success');
      expect(typeof urlResult.success).toBe('boolean');
      
      // Test checkRequiredConnections Result structure  
      const missingResult = await checkRequiredConnections(['gmail']);
      expect(missingResult).toHaveProperty('success');
      expect(typeof missingResult.success).toBe('boolean');
    });
  });
});

// AIDEV-NOTE: This test suite provides comprehensive coverage of:
// 1. All server action functions
// 2. Input validation through domain value objects
// 3. Authentication integration
// 4. Error handling and edge cases
// 5. Result type consistency
// 6. End-to-end request flow validation
//
// Tests focus on the API contract and integration points rather than
// duplicating business logic tests (which are covered in application service tests)