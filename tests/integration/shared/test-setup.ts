import { getUserRepository, getOrganizationRepository } from '@/ddd/application/di/container';
import { UserId } from '@/ddd/domain/shared/value-objects/user-id';
import { EmailAddress } from '@/ddd/domain/shared/value-objects/email-address';
import { OrganizationName } from '@/ddd/domain/shared/value-objects/organization-name';
import { OrganizationId } from '@/ddd/domain/shared/value-objects/organization-id';
import type { CreateUserData } from '@/ddd/domain/users/entities/user';
import type { CreateOrganizationData } from '@/ddd/domain/organizations/entities/organization';

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