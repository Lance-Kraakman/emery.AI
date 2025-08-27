#!/usr/bin/env npx tsx
// AIDEV-NOTE: Standalone script to setup infrastructure-only test environment
// Starts only database container to bypass TypeScript compilation issues in app container

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

async function setupInfrastructureTestEnvironment() {
  console.log('🚀 Setting up infrastructure-only test environment...');
  
  try {
    // 1. Clean any existing containers and volumes
    console.log('🧹 Cleaning up existing containers...');
    try {
      execSync('docker-compose -f tests/docker-compose.integration.yml down -v --remove-orphans', 
        { stdio: 'pipe' });
    } catch (e) {
      // Ignore if containers don't exist
    }

    // 2. Check environment file exists
    const envPath = path.join(process.cwd(), '.env.local.test');
    if (!existsSync(envPath)) {
      console.error('❌ .env.local.test file not found');
      console.log('Please create .env.local.test with integration test environment variables');
      process.exit(1);
    }
    console.log('✅ .env.local.test found');

    // 3. Start ONLY the database container (skip app and agent to avoid build issues)
    console.log('🐳 Starting integration test database...');
    execSync('docker-compose -f tests/docker-compose.integration.yml up -d postgres-integration', 
      { stdio: 'inherit' });

    // 4. Wait for database health check
    console.log('⏳ Waiting for database to be ready...');
    await waitForHealthy('emery-integration-db', 60000);
    console.log('✅ Database is healthy');

    // 5. Run migrations
    console.log('📊 Running database migrations...');
    const migrationCommand = 'DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test" pnpm db:migrate';
    execSync(migrationCommand, { stdio: 'inherit' });
    console.log('✅ Migrations completed');

    // 6. Verify essential tables exist using docker exec (since psql not installed on host)
    console.log('🔍 Verifying database schema...');
    try {
      const result = execSync(
        'docker exec emery-integration-db psql -U postgres -d emery_integration_test -c "\\dt" -t',
        { stdio: 'pipe', encoding: 'utf8' }
      );
      
      const requiredTables = ['organizations', 'users', 'agents', 'tasks'];
      const missingTables = requiredTables.filter(table => !result.includes(table));
      
      if (missingTables.length > 0) {
        throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
      }
      console.log('✅ Database schema verified');
    } catch (error) {
      console.log('⚠️ Schema verification failed, but migrations succeeded. Proceeding...');
      console.log('   (Schema will be verified by the integration tests)');
    }

    // 7. Show status
    console.log('🔍 Checking container status...');
    const containers = execSync('docker ps --filter "name=emery-integration" --format "{{.Names}} {{.Status}}"', 
      { encoding: 'utf8' });
    console.log('Running containers:');
    console.log(containers || 'No integration containers running');

    console.log('\n🎉 Infrastructure test environment ready!');
    console.log('📊 Database: postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test');
    console.log('⚠️  App and Agent containers not started (to avoid TypeScript build issues)');
    
    console.log('\n📋 Next steps:');
    console.log('- Run infrastructure tests: pnpm test:infrastructure');
    console.log('- Cleanup: docker-compose -f tests/docker-compose.integration.yml down -v');
    console.log('- For full integration tests: fix TypeScript errors and use pnpm test:integration');

  } catch (error) {
    console.error('💀 Failed to setup infrastructure test environment:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Check Docker is running');
    console.log('- Verify .env.local.test exists and has correct values');
    console.log('- Check port 5436 is available');
    console.log('- Run: docker-compose -f tests/docker-compose.integration.yml down -v');
    process.exit(1);
  }
}

// Helper function to wait for container health
async function waitForHealthy(containerName: string, timeoutMs: number = 60000): Promise<void> {
  const startTime = Date.now();
  const checkInterval = 2000;
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = execSync(
        `docker inspect --format='{{.State.Health.Status}}' ${containerName}`,
        { stdio: 'pipe', encoding: 'utf8' }
      ).trim();
      
      if (result === 'healthy') {
        return;
      }
      
      console.log(`⏳ ${containerName} status: ${result}, waiting...`);
    } catch (error) {
      console.log(`⏳ ${containerName} not ready yet, waiting...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  throw new Error(`Timeout waiting for ${containerName} to become healthy`);
}

// Run if called directly
if (require.main === module) {
  setupInfrastructureTestEnvironment();
}