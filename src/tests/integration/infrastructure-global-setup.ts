import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

// AIDEV-NOTE: Infrastructure-only global setup for integration tests
// Only starts database container to avoid TypeScript build issues with app container

export async function setup() {
  console.log('🔧 Setting up infrastructure-only test environment...');
  
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
    console.warn('⚠️  .env.local.test not found. Integration tests may fail...');
  }
  
  console.log('🐳 Starting integration test database only...');
  
  // Start ONLY the database container
  try {
    execSync('docker-compose -f tests/docker-compose.integration.yml up -d postgres-integration', 
      { stdio: 'inherit', cwd: process.cwd() });
  } catch (error) {
    console.error('❌ Failed to start database container:', error);
    throw error;
  }
  
  // Wait for database to be healthy
  console.log('⏳ Waiting for database to become healthy...');
  await waitForHealthy('emery-integration-db', 60000);
  
  console.log('🔄 Running database migrations...');
  
  // Run migrations with retry logic
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
  
  // Set environment variables for tests
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
  process.env.TEST_APP_URL = 'http://localhost:3002'; // Won't be used in infrastructure tests
  process.env.TEST_GRPC_URL = 'localhost:50053'; // Won't be used in infrastructure tests
  
  console.log('✅ Infrastructure test environment ready (database only)');
  console.log('   📊 Database: localhost:5436');
  console.log('   ⚠️  App and Agent containers not started');
}

export async function teardown() {
  console.log('🧹 Cleaning up infrastructure test containers...');
  
  try {
    // Only cleanup the database container and volumes
    execSync('docker-compose -f tests/docker-compose.integration.yml down -v --remove-orphans', 
      { stdio: 'inherit', cwd: process.cwd() });
      
    console.log('✅ Infrastructure test cleanup complete');
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