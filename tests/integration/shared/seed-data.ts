import { 
  getOrganizationRepository, 
  getUserRepository, 
  getContextAwareDb,
  initializeDI
} from '@/ddd/application/di/container';
import { 
  OrganizationName, 
  UserId, 
  EmailAddress, 
  OrganizationId 
} from '@/ddd/domain/shared/value-objects';
import { db, rawClient } from '@/lib/db/client';
import { sql } from 'drizzle-orm';

// AIDEV-NOTE: Seed data functions using domain repositories and services
// Uses proper RLS context and domain logic instead of raw SQL

export async function seedTestOrganizations() {
  // Ensure DI is initialized
  try {
    initializeDI(db, rawClient);
  } catch (e) {
    // May already be initialized
  }
  
  const orgRepo = getOrganizationRepository();
  const contextDb = getContextAwareDb();
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
  
  try {
    // Set context for org 1
    contextDb.setContext(SYSTEM_USER_ID, 1);
    
    await orgRepo.createWithOwner(
      {
        name: new OrganizationName('Test Organization 1'),
        slug: 'test-organization-1'
      },
      UserId.fromString('550e8400-e29b-41d4-a716-446655440001')
    );
    
    // Set context for org 2
    contextDb.setContext(SYSTEM_USER_ID, 2);
    
    await orgRepo.createWithOwner(
      {
        name: new OrganizationName('Test Organization 2'),
        slug: 'test-organization-2'
      },
      UserId.fromString('550e8400-e29b-41d4-a716-446655440002')
    );
  } finally {
    contextDb.clearContext();
  }
}

export async function seedTestUsers() {
  // Ensure DI is initialized
  try {
    initializeDI(db, rawClient);
  } catch (e) {
    // May already be initialized
  }
  
  const userRepo = getUserRepository();
  const contextDb = getContextAwareDb();
  const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
  
  try {
    contextDb.setContext(SYSTEM_USER_ID, 1);
    
    await userRepo.create({
      id: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
      email: EmailAddress.fromString('test1@example.com'),
      name: 'Test User 1',
      organizationRole: 'owner',
      currentOrganizationId: OrganizationId.fromNumber(1)
    });
    
    contextDb.setContext(SYSTEM_USER_ID, 2);
    
    await userRepo.create({
      id: UserId.fromString('550e8400-e29b-41d4-a716-446655440002'),
      email: EmailAddress.fromString('test2@example.com'),
      name: 'Test User 2',
      organizationRole: 'owner',
      currentOrganizationId: OrganizationId.fromNumber(2)
    });
  } finally {
    contextDb.clearContext();
  }
}

export async function seedTestUserOrganizations() {
  // This is now handled by createWithOwner in the organization repository
  // The userOrganizations entries are created automatically
  console.log('User organizations are created automatically by createWithOwner');
}

// REMOVED seedTestRoles - roles table doesn't exist in simplified RBAC

export async function seedBasicTestData() {
  // AIDEV-NOTE: No longer doing seed data here. Individual tests will create
  // their own test data using proper domain services as needed.
  // This avoids the bootstrap chicken-and-egg problem entirely.
  console.log('✅ Basic test data seeding skipped - tests create their own data using domain services');
}