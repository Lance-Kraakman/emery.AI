import { getUserRepository, getOrganizationRepository, getAgentRepository, getTeamApplicationService, initializeDI } from '@/ddd/application/di/container';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { EmailAddress } from '@/ddd/domain/shared/value-objects/email-address';
import { OrganizationName } from '@/ddd/domain/shared/value-objects/organization-name';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import { AgentId } from '@/ddd/domain/shared/value-objects/agent-id';
import { TeamId } from '@/ddd/domain/shared/value-objects/team-id';
import { AgentStatus } from '@/ddd/domain/shared/value-objects/agent-status';
import type { CreateUserData } from '@/ddd/domain/users/entities/user';
import type { CreateOrganizationData } from '@/ddd/domain/organizations/entities/organization';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import type { Team } from '@/ddd/domain/teams/entities/team';
import type { CreateTeamCommand } from '@/ddd/application/services/teams/team-application-service';
import { testClient } from './integration-helpers';

export interface TestContext {
  organizationId: OrganizationId;
  organizationName: OrganizationName;
  ownerUserId: UserId;
  adminUserId?: UserId;
  memberUserId?: UserId;
}

/**
 * Create a test organization with an owner user
 * Uses superuser connection so no RLS blocking
 * 
 * AIDEV-NOTE: Uses consistent repository pattern with proper error handling
 * and unique identifiers to prevent test conflicts.
 */
export async function createTestOrganization(
  name: string = 'Test Organization'
): Promise<TestContext> {
  const organizationRepository = getOrganizationRepository();
  const userRepository = getUserRepository();
  
  // Create unique identifiers to prevent conflicts between concurrent tests
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  const uniqueName = `${name} ${timestamp}-${random}`;
  const uniqueSlug = `${name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${random}`;
  
  try {
    // Create owner user ID first
    const ownerUserId = UserId.generate();
    
    // AIDEV-NOTE: Create user first since user_organizations requires foreign key to exist
    const userData: CreateUserData = {
      id: ownerUserId,
      name: 'Test Owner',
      email: EmailAddress.fromString(`owner-${timestamp}-${random}@test.com`),
      organizationRole: 'owner'
      // Don't set currentOrganizationId yet - will be set by createWithOwner
    };
    
    const owner = await userRepository.create(userData);
    
    // Create organization with owner using the proper method (user exists now)
    const orgData: CreateOrganizationData = {
      name: OrganizationName.fromString(uniqueName),
      slug: uniqueSlug,
      mission: 'Integration test organization'
    };
    
    // Use createWithOwner to establish proper relationships and update user
    const org = await organizationRepository.createWithOwner(orgData, ownerUserId);
    
    return {
      organizationId: org.id,
      organizationName: org.name,
      ownerUserId: ownerUserId
    };
    
  } catch (error) {
    console.error(`Failed to create test organization "${uniqueName}":`, error);
    // Add more context to the error
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        console.error(`Slug conflict detected: ${uniqueSlug}`);
      } else if (error.message.includes('user_organizations')) {
        console.error('User-organization relationship conflict');
      }
    }
    throw error;
  }
}

/**
 * Create a test organization with multiple users for role testing
 * 
 * AIDEV-NOTE: Creates owner, admin, and member users for RBAC testing.
 * Uses proper domain repository pattern with error handling.
 */
export async function createTestOrganizationWithRoles(
  name: string = 'Test Organization'
): Promise<TestContext> {
  const organizationRepository = getOrganizationRepository();
  const userRepository = getUserRepository();
  
  // Create unique identifiers to prevent conflicts
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  const uniqueName = `${name} ${timestamp}-${random}`;
  const uniqueSlug = `${name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}-${random}`;
  
  try {
    // Create user IDs first
    const ownerUserId = UserId.generate();
    const adminUserId = UserId.generate();
    const memberUserId = UserId.generate();
    
    // AIDEV-NOTE: Create owner user first since user_organizations requires foreign key to exist
    const ownerData: CreateUserData = {
      id: ownerUserId,
      name: 'Test Owner',
      email: EmailAddress.fromString(`owner-${timestamp}-${random}@rbac-test.com`),
      organizationRole: 'owner'
      // Don't set currentOrganizationId yet - will be set by createWithOwner
    };
    const owner = await userRepository.create(ownerData);
    
    // Create organization with owner using the proper method (owner user exists now)
    const orgData: CreateOrganizationData = {
      name: OrganizationName.fromString(uniqueName),
      slug: uniqueSlug,
      mission: 'RBAC test organization'
    };
    
    // Use createWithOwner to establish proper relationships for owner
    const org = await organizationRepository.createWithOwner(orgData, ownerUserId);
    
    // Create admin user record with organization context
    const adminData: CreateUserData = {
      id: adminUserId,
      name: 'Test Admin',
      email: EmailAddress.fromString(`admin-${timestamp}-${random}@rbac-test.com`),
      organizationRole: 'admin',
      currentOrganizationId: org.id
    };
    const admin = await userRepository.create(adminData);
    
    // Create member user record with organization context
    const memberData: CreateUserData = {
      id: memberUserId,
      name: 'Test Member',
      email: EmailAddress.fromString(`member-${timestamp}-${random}@rbac-test.com`),
      organizationRole: 'member',
      currentOrganizationId: org.id
    };
    const member = await userRepository.create(memberData);
    
    // Add additional users to organization membership
    try {
      await organizationRepository.addMember(org.id, adminUserId, { value: 'admin' } as any);
      await organizationRepository.addMember(org.id, memberUserId, { value: 'member' } as any);
    } catch (error) {
      // Log but don't fail if addMember isn't available or memberships already exist
      console.warn(`Could not add user memberships (may not be required): ${error}`);
    }
    
    return {
      organizationId: org.id,
      organizationName: org.name,
      ownerUserId: ownerUserId,
      adminUserId: adminUserId,
      memberUserId: memberUserId
    };
    
  } catch (error) {
    console.error(`Failed to create test organization with roles "${uniqueName}":`, error);
    // Add more context to the error
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        console.error(`Slug conflict detected: ${uniqueSlug}`);
      } else if (error.message.includes('user_organizations')) {
        console.error('User-organization relationship conflict');
      }
    }
    throw error;
  }
}

/**
 * Create a test user in an existing organization
 * 
 * AIDEV-NOTE: Creates user with specified role and organization context.
 * Used for permission testing scenarios.
 */
export async function createTestUser(
  email: string,
  name: string,
  organizationId: OrganizationId | number,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<{ id: string; email: string; name: string; organizationRole: string }> {
  const userRepository = getUserRepository();
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  const uniqueEmail = email.includes('@') ? email.replace('@', `-${timestamp}-${random}@`) : `${email}-${timestamp}-${random}@test.com`;
  
  const userId = UserId.generate();
  const orgId = typeof organizationId === 'number' ? organizationId : organizationId.value;
  
  const userData: CreateUserData = {
    id: userId,
    name,
    email: EmailAddress.fromString(uniqueEmail),
    organizationRole: role,
    currentOrganizationId: OrganizationId.fromNumber(orgId)
  };
  
  const user = await userRepository.create(userData);
  
  return {
    id: user.id.value,
    email: user.email?.value || '',
    name: user.name || '',
    organizationRole: (user.organizationRole as any)?.value || user.organizationRole || 'member'
  };
}

/**
 * Create a test agent for permission testing
 * 
 * AIDEV-NOTE: Creates agent with owner and organization context.
 * Returns agent with numeric ID for permission testing.
 */
export async function createTestAgent(
  name: string,
  ownerId: UserId,
  organizationId: OrganizationId
): Promise<{ id: AgentId; name: string; ownerId: UserId; organizationId: OrganizationId }> {
  const agentRepository = getAgentRepository();
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  const uniqueName = `${name} ${timestamp}-${random}`;
  
  const agentEntity: Agent = {
    id: AgentId.newEntity(), // New entity, ID will be set by repository
    name: uniqueName,
    role: 'assistant',
    description: 'Test agent description',
    persona: 'Test agent persona',
    tools: [],
    servers: [],
    capabilities: [],
    status: AgentStatus.fromString('active'),
    organizationId,
    ownerId,
    databaseId: null,
    apiKey: null,
    agentType: 'general',
    specialization: undefined,
    trigger: undefined,
    createdAt: null,
    updatedAt: null
  };
  
  const agent = await agentRepository.save(agentEntity);
  
  return {
    id: agent.id,
    name: agent.name,
    ownerId: agent.ownerId,
    organizationId: agent.organizationId
  };
}

/**
 * Create a test team for permission testing
 * 
 * AIDEV-NOTE: Creates team with organization context.
 * Returns team with numeric ID for permission testing.
 */
export async function createTestTeam(
  name: string,
  organizationId: OrganizationId
): Promise<{ id: TeamId; name: string; organizationId: OrganizationId }> {
  const teamApplicationService = getTeamApplicationService();
  
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  const uniqueName = `${name} ${timestamp}-${random}`;
  
  const command = {
    name: uniqueName,
    organizationId: organizationId.value,
    description: 'Test team for permission testing'
  };
  
  const result = await teamApplicationService.createTeam(command);
  
  if (!result.success) {
    throw new Error(`Failed to create test team: ${result.error}`);
  }
  
  return {
    id: result.data!.id,
    name: result.data!.name,
    organizationId: result.data!.organizationId
  };
}

/**
 * Initialize DI container with proper context-aware database client for integration tests
 * 
 * AIDEV-NOTE: This ensures tests use the context-aware database client for RLS functionality
 * while providing the raw client for cleanup operations.
 */
export function initializeTestDI(): void {
  // Use context-aware client for repositories (handles RLS automatically)
  initializeDI(testClient.db as any);
  console.log('✅ DI container initialized with context-aware database client for tests');
}