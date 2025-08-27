import { db } from '@/lib/db/client';
import { organizations, users, userOrganizations, roles } from '@/lib/db/schema';

// AIDEV-NOTE: Seed data functions using Drizzle ORM
// Clean, reusable test data setup functions

export async function seedTestOrganizations() {
  await db.insert(organizations)
    .values([
      { id: 1, name: 'Test Organization 1' },
      { id: 2, name: 'Test Organization 2' }
    ])
    .onConflictDoNothing();
}

export async function seedTestUsers() {
  await db.insert(users)
    .values([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        email: 'test1@example.com',
        name: 'Test User 1',
        currentOrganizationId: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002', 
        email: 'test2@example.com',
        name: 'Test User 2',
        currentOrganizationId: 2
      }
    ])
    .onConflictDoNothing();
}

export async function seedTestUserOrganizations() {
  await db.insert(userOrganizations)
    .values([
      {
        userId: '550e8400-e29b-41d4-a716-446655440001',
        organizationId: 1,
        role: 'owner'
      },
      {
        userId: '550e8400-e29b-41d4-a716-446655440002',
        organizationId: 2, 
        role: 'owner'
      }
    ])
    .onConflictDoNothing();
}

export async function seedTestRoles() {
  await db.insert(roles)
    .values([
      {
        id: 1,
        name: 'Test Role',
        permissions: ['view_agents', 'create_agents'],
        organizationId: 1
      },
      {
        id: 2,
        name: 'Test Role',
        permissions: ['view_agents', 'create_agents'],
        organizationId: 2
      }
    ])
    .onConflictDoNothing();
}

export async function seedBasicTestData() {
  await seedTestOrganizations();
  await seedTestUsers();
  await seedTestUserOrganizations();
  await seedTestRoles();
}