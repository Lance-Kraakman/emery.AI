#!/usr/bin/env npx tsx
// AIDEV-NOTE: Standalone script to setup integration test environment
// Can be run independently of vitest for manual testing and debugging

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

async function setupIntegrationTestEnvironment() {
  console.log('🚀 Setting up integration test environment...');
  
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

    // 3. Start containers
    console.log('🐳 Starting integration test containers...');
    execSync('docker-compose -f tests/docker-compose.integration.yml up -d --build', 
      { stdio: 'inherit' });

    // 4. Wait for health checks (simplified - just wait for postgres)
    console.log('⏳ Waiting for database to be ready...');
    await waitForHealthy('emery-integration-db', 60000);
    console.log('✅ Database is healthy');

    // 5. Run migrations
    console.log('📊 Running database migrations...');
    const migrationCommand = 'DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test" pnpm db:migrate';
    execSync(migrationCommand, { stdio: 'inherit' });
    console.log('✅ Migrations completed');

    // 6. Verify setup
    console.log('🔍 Verifying integration test environment...');
    const containers = execSync('docker ps --filter "name=emery-integration" --format "{{.Names}} {{.Status}}"', 
      { encoding: 'utf8' });
    console.log('Running containers:');
    console.log(containers);

    console.log('\n🎉 Integration test environment ready!');
    console.log('📊 Database: postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test');
    console.log('🌐 App: http://localhost:3002 (when app container is ready)');
    console.log('🤖 Agent: localhost:50053 (when agent container is ready)');
    
    console.log('\n📋 Next steps:');
    console.log('- Run tests: pnpm test:integration');
    console.log('- Or run specific test: pnpm test:integration tests/integration/api/agents.integration.test.ts');
    console.log('- Cleanup: docker-compose -f tests/docker-compose.integration.yml down -v');

  } catch (error) {
    console.error('💀 Failed to setup integration test environment:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Check Docker is running');
    console.log('- Verify .env.local.test exists and has correct values');
    console.log('- Check ports 5436, 3002, 50053 are available');
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
  setupIntegrationTestEnvironment();
}