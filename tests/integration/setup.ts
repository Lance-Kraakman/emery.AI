import { beforeAll, afterEach } from 'vitest';
import { testClient } from './shared/integration-helpers';

// AIDEV-NOTE: Setup that runs before each test file
// Ensures database schema and basic test data are ready

beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...');
  
  // Check if we're running against persistent server
  const isPersistentServer = process.env.PERSISTENT_TEST_SERVER === 'true';
  
  if (isPersistentServer) {
    console.log('🚀 Running against persistent test server...');
    
    // For persistent server, just verify connectivity
    // Assume containers are already running and healthy
    try {
      await testClient.verifyDatabaseConnection();
      await testClient.verifyDatabaseSchema();
      console.log('✅ Persistent server connectivity verified');
    } catch (error) {
      console.error('❌ Persistent server not accessible. Start server with: pnpm test:integration:server');
      throw error;
    }
  } else {
    console.log('🐳 Running with container lifecycle management...');
    
    // Standard setup - verify database connection and schema
    await testClient.verifyDatabaseConnection();
    await testClient.verifyDatabaseSchema();
  }
  
  // AIDEV-NOTE: No longer seeding global test data - each test creates its own
  // This ensures proper isolation and lets each test use domain services
  
  console.log('✅ Integration test setup complete');
});

afterEach(async () => {
  // Clean test data between tests but preserve schema and basic seed data
  // This ensures each test starts with a clean slate
  await testClient.cleanTestData();
});