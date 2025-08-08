/**
 * Setup user authentication for integration testing
 * 
 * This script helps you:
 * 1. Find your user ID after logging in via OAuth
 * 2. Generate a user API key for integration tests
 * 3. Verify your authentication setup
 */

import { db } from '../lib/db/client';
import { users, organizations } from '../lib/db/schema';
import { assignApiKeyToUser, validateUserApiKey } from '../lib/auth/user-api-keys';
import { eq } from 'drizzle-orm';

async function setupUserAuth() {
  console.log('🔐 USER AUTHENTICATION SETUP');
  console.log('==============================\n');

  try {
    // Step 1: List all users
    console.log('1️⃣  Checking existing users...\n');
    
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        organizationId: users.organizationId,
        hasApiKey: users.apiKey,
      })
      .from(users);

    if (allUsers.length === 0) {
      console.log('❌ No users found in database!');
      console.log('   Please:');
      console.log('   1. Start the NextJS server: pnpm dev');
      console.log('   2. Go to http://localhost:3000');
      console.log('   3. Log in with GitHub or Google OAuth');
      console.log('   4. Run this script again\n');
      return;
    }

    console.log(`📊 Found ${allUsers.length} user(s):\n`);
    allUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email || 'No email'}`);
      console.log(`      ID: ${user.id}`);
      console.log(`      Name: ${user.name || 'No name'}`);
      console.log(`      Organization: ${user.organizationId || 'None'}`);
      console.log(`      API Key: ${user.hasApiKey ? '✅ Has key' : '❌ No key'}`);
      console.log('');
    });

    // Step 2: Check organizations
    console.log('2️⃣  Checking organizations...\n');
    
    const allOrgs = await db.select().from(organizations);
    console.log(`📊 Found ${allOrgs.length} organization(s):\n`);
    allOrgs.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
    });
    console.log('');

    // Step 3: Generate API keys for users without them
    console.log('3️⃣  Setting up API keys...\n');
    
    for (const user of allUsers) {
      if (!user.hasApiKey) {
        console.log(`🔑 Generating API key for ${user.email || user.id}...`);
        const apiKey = await assignApiKeyToUser(user.id);
        console.log(`   ✅ API Key: ${apiKey}\n`);
      } else {
        console.log(`✅ ${user.email || user.id} already has an API key\n`);
      }
    }

    // Step 4: Provide configuration for integration tests
    console.log('4️⃣  Integration test configuration...\n');
    
    const firstUser = allUsers[0];
    console.log('📋 Use this configuration for integration tests:\n');
    console.log('```typescript');
    console.log(`const USER_ACCOUNT_ID = '${firstUser.id}';`);
    console.log(`const USER_ORGANIZATION_ID = ${firstUser.organizationId || 1};`);
    console.log('```\n');

    // Get the updated user with API key
    const updatedUser = await db
      .select()
      .from(users)
      .where(eq(users.id, firstUser.id))
      .limit(1);
    
    if (updatedUser[0]?.apiKey) {
      console.log('🔐 API Key Authentication:\n');
      console.log('```bash');
      console.log(`export USER_API_KEY="${updatedUser[0].apiKey}"`);
      console.log('```\n');
      
      console.log('Or use in curl:\n');
      console.log('```bash');
      console.log(`curl -H "Authorization: Bearer ${updatedUser[0].apiKey}" \\`);
      console.log('     http://localhost:3000/api/scheduler/status');
      console.log('```\n');

      // Step 5: Test the API key
      console.log('5️⃣  Testing API key authentication...\n');
      
      const testResult = await validateUserApiKey(updatedUser[0].apiKey);
      if (testResult) {
        console.log('✅ API Key validation successful!');
        console.log(`   User: ${testResult.email}`);
        console.log(`   Organization: ${testResult.organizationId}\n`);
      } else {
        console.log('❌ API Key validation failed\n');
      }
    }

    console.log('🎉 User authentication setup complete!\n');
    console.log('📖 Next steps:');
    console.log('1. Copy the USER_ACCOUNT_ID and USER_ORGANIZATION_ID above');
    console.log('2. Update your integration test with these values');
    console.log('3. Use the API key for authentication in scripts');
    console.log('4. Or log in via browser and use session authentication\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

if (require.main === module) {
  setupUserAuth().catch((error) => {
    console.error('Setup error:', error);
    process.exit(1);
  });
}

export { setupUserAuth };