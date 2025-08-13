#!/usr/bin/env tsx
/**
 * Seed test data for Emery development and testing
 * 
 * Creates:
 * - Test user with proper authentication
 * - Test organization with permissions
 * - Test agents with various configurations
 * - Test capabilities and tools
 * - OAuth connections for testing
 * 
 * Usage: npx tsx scripts/seed-test-data.ts [--clean]
 */

import { db, rawClient } from '../lib/db/client';
import { users, organizations, agents, userOrganizations, roles } from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// Test user configuration
const TEST_USER = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Test User',
  email: 'test@emery.dev',
  image: null,
  emailVerified: null,
};

const TEST_ORG = {
  name: 'Test Organization',
  mission: 'Organization for development and testing',
};

const TEST_AGENTS = [
  {
    name: 'Test Assistant',
    description: 'A general-purpose test agent for development',
    persona: 'You are a helpful test assistant that can perform various tasks.',
    capabilities: [
      {
        name: 'test_capability',
        description: 'Test capability for infrastructure validation',
        steps: [
          {
            id: 'test_step_1',
            type: 'TOOL_STEP',
            instructions: 'Return success response with trigger data',
            model: 'claude-3-sonnet-20240229',
            tools: [],
            servers: []
          }
        ]
      },
      {
        name: 'ping',
        description: 'Simple ping test',
        steps: [
          {
            id: 'ping_step',
            type: 'CODE_STEP',
            instructions: 'Return a pong response',
            model: 'claude-3-sonnet-20240229',
            tools: [],
            servers: []
          }
        ]
      },
      {
        name: 'health_check',
        description: 'Health check capability',
        steps: [
          {
            id: 'health_step',
            type: 'CODE_STEP',
            instructions: 'Check system health and return status',
            model: 'claude-3-sonnet-20240229',
            tools: [],
            servers: []
          }
        ]
      }
    ],
    tools: [],
    servers: []
  },
  {
    name: 'Email Agent',
    description: 'Specialized agent for email automation',
    persona: 'You are an email automation specialist.',
    capabilities: [
      {
        name: 'send_email',
        description: 'Send emails via Gmail',
        steps: [
          {
            id: 'compose_email',
            type: 'CODE_STEP',
            instructions: 'Compose email content',
            model: 'claude-3-haiku-20240307',
            tools: [],
            servers: []
          },
          {
            id: 'format_response',
            type: 'CODE_STEP',
            instructions: 'Format the email response for output',
            model: 'claude-3-haiku-20240307',
            tools: [],
            servers: []
          }
        ]
      }
    ],
    tools: [],
    servers: []
  }
];

function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function cleanDatabase(organizationId: number) {
  console.log('🧹 Cleaning existing test data...');
  
  // Delete in dependency order to avoid foreign key constraints
  await db.delete(agents).where(eq(agents.organizationId, organizationId));
  await db.delete(userOrganizations).where(and(
    eq(userOrganizations.userId, TEST_USER.id),
    eq(userOrganizations.organizationId, organizationId)
  ));
  // Delete roles before organization
  await db.delete(roles).where(eq(roles.organizationId, organizationId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
  await db.delete(users).where(eq(users.id, TEST_USER.id));
  
  console.log('✅ Cleaned existing test data');
}

async function createTestUser() {
  console.log('👤 Creating test user...');
  
  // Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.id, TEST_USER.id)).limit(1);
  
  let user;
  if (existingUser.length === 0) {
    // Create user with API key for testing
    const apiKey = `user_${generateApiKey()}`;
    [user] = await db.insert(users).values({
      ...TEST_USER,
      apiKey
    }).returning();
    console.log(`✅ Created test user: ${TEST_USER.email}`);
    console.log(`✅ User API Key: ${apiKey}`);
  } else {
    user = existingUser[0];
    console.log(`✅ Test user already exists: ${TEST_USER.email}`);
    
    // Add API key if it doesn't exist
    if (!user.apiKey) {
      const apiKey = `user_${generateApiKey()}`;
      await db.update(users).set({ apiKey }).where(eq(users.id, TEST_USER.id));
      console.log(`✅ Added User API Key: ${apiKey}`);
      user.apiKey = apiKey;
    } else {
      console.log(`✅ User API Key: ${user.apiKey}`);
    }
  }
  
  return { id: TEST_USER.id, apiKey: user.apiKey };
}

async function createTestOrganization(userInfo: { id: string, apiKey: string }) {
  console.log('🏢 Creating test organization...');
  
  // Create organization
  const [organization] = await db.insert(organizations).values(TEST_ORG).returning();
  console.log(`✅ Created organization: ${organization.name} (ID: ${organization.id})`);
  
  // Add user to organization
  await db.insert(userOrganizations).values({
    userId: userInfo.id,
    organizationId: organization.id,
    role: 'owner'
  });
  
  // Get or create Super Admin role
  let [superAdminRole] = await db.select().from(roles)
    .where(and(
      eq(roles.name, 'Super Admin'),
      eq(roles.organizationId, organization.id)
    )).limit(1);
  
  if (!superAdminRole) {
    [superAdminRole] = await db.insert(roles).values({
      name: 'Super Admin',
      organizationId: organization.id,
      permissions: ['*'] // All permissions
    }).returning();
  }
  
  // Assign Super Admin role to user (update user's roleId)
  await db.update(users).set({
    roleId: superAdminRole.id
  }).where(eq(users.id, userInfo.id));
  
  console.log(`✅ Added user to organization with Super Admin role`);
  
  return organization;
}

async function createTestAgents(userId: string, organizationId: number) {
  console.log('🤖 Creating test agents...');
  
  const createdAgents = [];
  
  for (const agentConfig of TEST_AGENTS) {
    const apiKey = generateApiKey();
    
    const [agent] = await db.insert(agents).values({
      name: agentConfig.name,
      description: agentConfig.description,
      persona: agentConfig.persona,
      capabilities: agentConfig.capabilities,
      tools: agentConfig.tools,
      servers: agentConfig.servers,
      ownerId: userId,
      organizationId: organizationId,
      apiKey: apiKey,
      status: 'active'
    }).returning();
    
    createdAgents.push(agent);
    console.log(`✅ Created agent: ${agent.name} (ID: ${agent.id}, API Key: ${apiKey.substring(0, 8)}...)`);
  }
  
  return createdAgents;
}

async function createTestTables() {
  console.log('📊 Creating test database tables...');
  
  try {
    // Create a simple test table
    await rawClient`
      CREATE TABLE IF NOT EXISTS test_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        field_1 TEXT, -- name
        field_2 TEXT, -- status  
        field_3 INTEGER, -- priority
        field_4 BOOLEAN, -- is_active
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Insert some test data
    await rawClient`
      INSERT INTO test_projects (field_1, field_2, field_3, field_4)
      VALUES 
        ('Test Project Alpha', 'active', 1, true),
        ('Test Project Beta', 'planning', 2, true),
        ('Test Project Gamma', 'completed', 3, false)
      ON CONFLICT DO NOTHING
    `;
    
    console.log('✅ Created test database table with sample data');
  } catch (error) {
    console.log('⚠️  Test table creation skipped (already exists)');
  }
}

async function printSeedSummary(organization: any, createdAgents: any[], userApiKey: string) {
  console.log('\n📋 Seed Data Summary');
  console.log('='.repeat(50));
  console.log(`User ID: ${TEST_USER.id}`);
  console.log(`User Email: ${TEST_USER.email}`);
  console.log(`Organization: ${organization.name} (ID: ${organization.id})`);
  console.log(`Organization Mission: ${organization.mission}`);
  console.log('\nAgents Created:');
  
  for (const agent of createdAgents) {
    console.log(`  - ${agent.name} (ID: ${agent.id})`);
    console.log(`    API Key: ${agent.apiKey}`);
    console.log(`    Capabilities: ${agent.capabilities?.length || 0}`);
  }
  
  console.log('\n🧪 API Testing Commands:');
  console.log(`curl -H "Authorization: Bearer ${userApiKey}" http://localhost:3000/api/agents`);
  console.log('\n📱 Frontend Testing:');
  console.log(`Visit: http://localhost:3000/mission-control (login as ${TEST_USER.email})`);
  console.log(`OAuth: http://localhost:3000/connections`);
  console.log('\n🔑 API Authentication:');
  console.log(`User API Key: ${userApiKey}`);
}

async function main() {
  const args = process.argv.slice(2);
  const shouldClean = args.includes('--clean');
  
  console.log('🌱 Seeding Emery test data...');
  console.log('='.repeat(50));
  
  try {
    // Create test user
    const userInfo = await createTestUser();
    
    // Create test organization  
    const organization = await createTestOrganization(userInfo);
    
    // Clean existing data if requested
    if (shouldClean) {
      await cleanDatabase(organization.id);
      // Recreate after cleaning
      const newOrg = await createTestOrganization(userId);
      var finalOrganization = newOrg;
    } else {
      var finalOrganization = organization;
    }
    
    // Create test agents
    const createdAgents = await createTestAgents(userInfo.id, finalOrganization.id);
    
    // Create test database tables
    await createTestTables();
    
    // Print summary
    await printSeedSummary(finalOrganization, createdAgents, userInfo.apiKey);
    
    console.log('\n✅ Seed data creation complete!');
    
  } catch (error) {
    console.error('❌ Seed data creation failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}