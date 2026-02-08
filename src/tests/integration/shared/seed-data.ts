import { 
  getOrganizationRepository, 
  getUserRepository, 
  initializeDI
} from '@/ddd/application/di/container';
import { 
  OrganizationName, 
  UserId, 
  EmailAddress, 
  OrganizationId 
} from '@/ddd/domain/shared/value-objects';
import { db } from '@/ddd/infrastructure/db/client';

// AIDEV-NOTE: Seed data functions using domain repositories and services
// Uses proper RLS context and domain logic instead of raw SQL

export async function seedTestOrganizations() {
  // Ensure DI is initialized
  try {
    initializeDI(db);
  } catch (e) {
    // May already be initialized
  }

  const orgRepo = getOrganizationRepository();

  // RLS policies work automatically with database defaults - create organizations directly
  const org1 = await orgRepo.createWithOwner(
    {
      name: new OrganizationName('Test Organization 1'),
      slug: 'test-organization-1'
    },
    UserId.fromString('550e8400-e29b-41d4-a716-446655440001')
  );

  const org2 = await orgRepo.createWithOwner(
    {
      name: new OrganizationName('Test Organization 2'),
      slug: 'test-organization-2'
    },
    UserId.fromString('550e8400-e29b-41d4-a716-446655440002')
  );

  // Add default credit balance to test organizations (10,000 credits = ~$10 worth)
  await orgRepo.update(org1.id, {
    creditBalance: 10000,
    creditsUsedCurrentMonth: 0,
    creditsResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  });

  await orgRepo.update(org2.id, {
    creditBalance: 10000,
    creditsUsedCurrentMonth: 0,
    creditsResetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  });
}

export async function seedTestUsers() {
  // Ensure DI is initialized
  try {
    initializeDI(db);
  } catch (e) {
    // May already be initialized
  }
  
  const userRepo = getUserRepository();
  
  // RLS policies work automatically with database defaults - create users directly
  await userRepo.create({
    id: UserId.fromString('550e8400-e29b-41d4-a716-446655440001'),
    email: EmailAddress.fromString('test1@example.com'),
    name: 'Test User 1',
    currentOrganizationId: OrganizationId.fromNumber(1)
  });
  
  await userRepo.create({
    id: UserId.fromString('550e8400-e29b-41d4-a716-446655440002'),
    email: EmailAddress.fromString('test2@example.com'),
    name: 'Test User 2',
    currentOrganizationId: OrganizationId.fromNumber(2)
  });
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