import { beforeAll, afterEach } from 'vitest';
import { testClient } from './shared/integration-helpers';

// AIDEV-NOTE: Setup that runs before each test file
// Ensures database schema and basic test data are ready

beforeAll(async () => {
  console.log('🔧 Setting up integration test environment...');
  
  // Verify database connection and schema
  await testClient.verifyDatabaseConnection();
  await testClient.verifyDatabaseSchema();
  
  // Seed minimal test data required for all tests
  await testClient.seedBasicTestData();
  
  console.log('✅ Integration test setup complete');
});

afterEach(async () => {
  // Clean test data between tests but preserve schema and basic seed data
  // This ensures each test starts with a clean slate
  await testClient.cleanTestData();
});