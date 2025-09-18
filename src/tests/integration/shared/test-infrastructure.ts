/**
 * Shared Test Infrastructure Management
 * 
 * Common functions for managing integration test containers, migrations, and services.
 * Used by both global-setup.ts (CI) and test-server-wrapper.ts (development).
 * 
 * AIDEV-NOTE: Single source of truth for test infrastructure setup
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { S3Client, HeadBucketCommand, ListObjectsV2Command, CreateBucketCommand } from '@aws-sdk/client-s3';

const DOCKER_COMPOSE_FILE = 'tests/docker-compose.integration.yml';

const CONTAINERS = [
  { name: 'emery-integration-db', timeout: 60000 },
  { name: 'emery-integration-minio', timeout: 60000 },
  { name: 'emery-integration-app', timeout: 120000 },
  { name: 'emery-integration-agent', timeout: 90000 }
];

/**
 * Start test containers with full setup (migrations, S3, health checks)
 */
export async function startTestContainers(): Promise<void> {
  console.log('🚀 Starting integration test infrastructure...');
  
  // Clean up any existing containers first
  await stopTestContainers();
  
  // Check for .env.local.test file
  console.log('🔍 Checking for .env.local.test file...');
  const envTestPath = path.join(process.cwd(), '.env.local.test');
  if (!existsSync(envTestPath)) {
    console.warn('⚠️  .env.local.test not found. Creating minimal version...');
    // Could create a minimal .env.local.test here if needed
  }
  
  // Start containers
  console.log('🐳 Starting Docker containers...');
  try {
    execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} up -d --force-recreate`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.error('❌ Failed to start containers:', error);
    throw error;
  }
  
  // Wait for all services to be healthy
  console.log('⏳ Waiting for services to become healthy...');
  for (const container of CONTAINERS) {
    await waitForHealthy(container.name, container.timeout);
  }
  
  // Run database migrations
  console.log('🔄 Running database migrations...');
  await runMigrations();
  
  // Verify database schema
  await verifyDatabaseSchema();
  
  // Setup S3 bucket
  console.log('🪣 Setting up S3 bucket...');
  await setupS3();
  
  // Set environment variables for tests
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
  process.env.TEST_APP_URL = 'http://localhost:3002';
  process.env.TEST_GRPC_URL = 'localhost:50053';
  
  console.log('✅ Integration test infrastructure ready!');
  showStatus();
}

/**
 * Stop and clean up test containers
 */
export async function stopTestContainers(): Promise<void> {
  console.log('🧹 Cleaning up integration test containers...');
  
  try {
    execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} down -v --remove-orphans`, 
      { stdio: 'inherit', cwd: process.cwd() });
    console.log('✅ Integration test cleanup complete');
  } catch (error) {
    // Ignore errors - containers might not exist
    console.log('⚠️  Error during cleanup (may be expected):', error);
  }
}

/**
 * Wait for a container to become healthy
 */
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

/**
 * Run database seeding in correct order
 */
async function runDatabaseSeeds(): Promise<void> {
  const baseEnv = 'NODE_ENV=test DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test"';
  
  console.log('🌱 Seeding RBAC data...');
  execSync(`${baseEnv} npx tsx drizzle/seeds/rbac.ts`, { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ RBAC seeding completed');

  console.log('🤖 Seeding system users...');
  execSync(`${baseEnv} npx tsx drizzle/seeds/system-users.ts`, { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ System users seeding completed');

  console.log('🔐 Assigning system user roles...');  
  execSync(`${baseEnv} npx tsx drizzle/seeds/system-role-assignments.ts`, { stdio: 'inherit', cwd: process.cwd() });
  console.log('✅ System role assignments completed');

  console.log('✅ All database seeding completed successfully');
}

/**
 * Run database migrations with retry logic
 */
async function runMigrations(): Promise<void> {
  const migrationCommand = 'DATABASE_URL="postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test" pnpm db:migrate';
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`📊 Migration attempt ${attempt}/3...`);
      execSync(migrationCommand, { stdio: 'inherit', cwd: process.cwd() });
      console.log('✅ Database migrations completed successfully');
      
      // Run all database seeding in order
      await runDatabaseSeeds();
      
      return;
    } catch (error) {
      console.error(`❌ Migration attempt ${attempt} failed`);
      if (attempt === 3) {
        console.error('💀 All migration attempts failed. Integration tests cannot proceed.');
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Verify database schema after migrations
 */
async function verifyDatabaseSchema(): Promise<void> {
  console.log('🔍 Verifying database schema...');
  try {
    const verifyCommand = 'docker exec emery-integration-db psql -U postgres -d emery_integration_test -c "\\dt" -t';
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
}

/**
 * Setup S3 bucket in MinIO
 */
async function setupS3(): Promise<void> {
  const maxRetries = 10;
  const retryDelay = 2000; // 2 seconds
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use external MinIO endpoint for testing from local machine
      const s3Client = new S3Client({
        endpoint: 'http://localhost:9005',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'minioadmin',
          secretAccessKey: 'minioadmin',
        },
        forcePathStyle: true,
      });

      console.log(`   🔍 Attempt ${attempt}/${maxRetries}: Checking if emery-files bucket exists...`);
      
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: 'emery-files' }));
        console.log('   ✅ emery-files bucket exists and is accessible');
      } catch (bucketError: any) {
        if (bucketError.name === 'NotFound') {
          console.log('   🪣 Bucket does not exist, creating it...');
          await s3Client.send(new CreateBucketCommand({ Bucket: 'emery-files' }));
          console.log('   ✅ emery-files bucket created successfully');
        } else {
          throw bucketError;
        }
      }

      // Test basic list operation
      console.log('   🔍 Testing bucket list operation...');
      await s3Client.send(new ListObjectsV2Command({ 
        Bucket: 'emery-files',
        MaxKeys: 1
      }));
      console.log('   ✅ S3 connectivity verification passed');
      return; // Success, exit retry loop
      
    } catch (error: any) {
      console.log(`   ⚠️  Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('   ❌ S3 connectivity verification failed after all retries');
        throw new Error(`S3 setup verification failed after ${maxRetries} attempts: ${error}`);
      }
      
      console.log(`   ⏳ Waiting ${retryDelay/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}

/**
 * Display status of running services
 */
function showStatus(): void {
  console.log('\n📊 Integration Test Infrastructure Status:');
  console.log('   🗄️  Database:  postgresql://localhost:5436/emery_integration_test');
  console.log('   🪣  S3 (MinIO): http://localhost:9005 (emery-files bucket)');
  console.log('   🌐  App Server: http://localhost:3002');
  console.log('   🤖  gRPC Agent: localhost:50053');
}