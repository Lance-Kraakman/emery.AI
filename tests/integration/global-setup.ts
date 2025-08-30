import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { S3Client, HeadBucketCommand, ListObjectsV2Command, CreateBucketCommand } from '@aws-sdk/client-s3';

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
  await waitForHealthy('emery-integration-db', 60000);    // 1 minute timeout
  await waitForHealthy('emery-integration-minio', 60000); // 1 minute timeout for MinIO
  await waitForHealthy('emery-integration-app', 120000);  // 2 minute timeout for build
  await waitForHealthy('emery-integration-agent', 90000); // 1.5 minute timeout
  
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
  
  // AIDEV-NOTE: No need to create test_user - using postgres superuser for tests
  // This allows us to bypass RLS for setup and set custom session variables for RLS testing

  // Set environment variables for tests (using postgres superuser to bypass RLS for setup)
  // AIDEV-NOTE: Using postgres user allows setting custom session variables for RLS testing
  process.env.TEST_DATABASE_URL = 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
  process.env.TEST_APP_URL = 'http://localhost:3002';
  process.env.TEST_GRPC_URL = 'localhost:50053';
  
  // Verify S3 (MinIO) connectivity and bucket existence
  console.log('🪣 Verifying S3 connectivity and bucket setup...');
  await verifyS3Setup();

  console.log('✅ Integration test environment ready');
  console.log('   📊 Database: localhost:5436');
  console.log('   🪣 S3:       localhost:9005 (emery-files bucket)');
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

// Helper function to verify S3 setup
async function verifyS3Setup(): Promise<void> {
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
      console.log('   ✅ Bucket list operation successful');
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