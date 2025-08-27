import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// AIDEV-NOTE: Global setup for integration tests
// Manages Docker container lifecycle and ensures clean state between test runs

export async function setup() {
  console.log('🧹 Cleaning up any existing integration containers...');
  
  // Force cleanup of previous test runs with volume removal
  try {
    execSync('docker-compose -f tests/docker-compose.integration.yml down -v --remove-orphans', 
      { stdio: 'pipe', cwd: process.cwd() });
  } catch (e) {
    // Ignore if containers don't exist
  }
  
  console.log('🔍 Checking for .env.local.test file...');
  const envTestPath = path.join(process.cwd(), '.env.local.test');
  if (!existsSync(envTestPath)) {
    console.warn('⚠️  .env.local.test not found. Creating minimal version...');
    // Could create a minimal .env.local.test here if needed
  }
  
  console.log('🐳 Starting fresh integration test containers...');
  
  // Start with clean volumes and force recreation
  try {
    execSync('docker-compose -f tests/docker-compose.integration.yml up -d --force-recreate', 
      { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.error('❌ Failed to start integration containers:', error);
    throw error;
  }
  
  // Wait for services to be healthy
  console.log('⏳ Waiting for services to become healthy...');
  await waitForHealthy('postgres-integration', 60000); // 1 minute timeout
  await waitForHealthy('app-integration', 120000);     // 2 minute timeout for build
  await waitForHealthy('agent-integration', 90000);    // 1.5 minute timeout
  
  console.log('🔄 Running database migrations on clean database...');
  
  // Run migrations on the integration test database with retry logic
  const migrationCommand = 'DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test" pnpm db:migrate';
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`📊 Migration attempt ${attempt}/3...`);
      execSync(migrationCommand, { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Database migrations completed successfully');
      break;
    } catch (error) {
      console.error(`❌ Migration attempt ${attempt} failed:`, error);
      if (attempt === 3) {
        console.error('💀 All migration attempts failed. Integration tests cannot proceed.');
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Verify migrations worked by checking essential tables exist
  console.log('🔍 Verifying database schema after migration...');
  try {
    const verifyCommand = 'DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test" psql -c "\\dt" -t';
    const result = execSync(verifyCommand, { stdio: 'pipe', encoding: 'utf8', cwd: process.cwd() });
    
    // Check for essential tables
    const requiredTables = ['organizations', 'users', 'agents', 'tasks'];
    const missingTables = requiredTables.filter(table => !result.includes(table));
    
    if (missingTables.length > 0) {
      throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
    }
    
    console.log('✅ Database schema verification passed');
  } catch (error) {
    console.error('❌ Database schema verification failed:', error);
    throw error;
  }
  
  // Set environment variables for tests
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
  process.env.TEST_APP_URL = 'http://localhost:3002';
  process.env.TEST_GRPC_URL = 'localhost:50053';
  
  console.log('✅ Integration test environment ready');
  console.log('   📊 Database: localhost:5436');
  console.log('   🌐 App:      localhost:3002');
  console.log('   🤖 Agent:    localhost:50053');
}

export async function teardown() {
  console.log('🧹 Cleaning up integration test containers...');
  
  try {
    // Always cleanup volumes to ensure clean state for next run
    execSync('docker-compose -f tests/docker-compose.integration.yml down -v --remove-orphans', 
      { stdio: 'inherit', cwd: process.cwd() });
      
    console.log('✅ Integration test cleanup complete');
  } catch (error) {
    console.error('⚠️  Error during cleanup (may be expected):', error);
  }
}

// Helper function to wait for container health checks
async function waitForHealthy(containerName: string, timeoutMs: number = 60000): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = execSync(
        `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
        { stdio: 'pipe', encoding: 'utf8' }
      ).trim();
      
      if (result === 'healthy') {
        console.log(`✅ ${containerName} is healthy`);
        return;
      }
      
      console.log(`⏳ ${containerName} status: ${result}, waiting...`);
    } catch (error) {
      // Container might not exist yet or no health check defined
      console.log(`⏳ ${containerName} not ready yet, waiting...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  throw new Error(`❌ Timeout waiting for ${containerName} to become healthy after ${timeoutMs}ms`);
}