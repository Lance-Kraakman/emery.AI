/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'persistent-integration',
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    // NO globalSetup - assumes containers are already running
    testTimeout: 60000,  // Increased timeout for embedding API calls
    hookTimeout: 10000,  // Much shorter since no container startup
    poolOptions: {
      threads: {
        singleThread: false // Can run in parallel since server is persistent
      }
    },
    // Don't isolate tests as aggressively - server is persistent
    isolate: false,
    // No retry needed - more stable with persistent server
    retry: 0,
    // Include integration tests only
    include: ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Exclude unit test patterns  
    exclude: ['__tests__/**/*', 'tests/rls/**/*', 'tests/unit/**/*'],
    // More concise reporter for faster dev feedback
    reporters: ['basic'],
    // No coverage for fast development testing
    coverage: {
      enabled: false
    },
    // Environment variables for persistent server
    env: {
      // AIDEV-NOTE: Set DATABASE_URL so application services use test database
      DATABASE_URL: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test',
      TEST_DATABASE_URL: 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test',
      TEST_APP_URL: 'http://localhost:3002',
      TEST_GRPC_URL: 'localhost:50053',
      WORKER_ADDRESS: 'localhost:50053',
      NODE_ENV: 'test',
      // AI/ML API Keys  
      HF_TOKEN: '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',
      OPENAI_API_KEY: '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',
      // AI/ML API Keys for real functionality (not mocked)
      // S3 Configuration (MinIO for integration tests - matches .env.local.test)
      AWS_ACCESS_KEY_ID: 'minioadmin',
      AWS_SECRET_ACCESS_KEY: 'minioadmin',
      AWS_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'emery-files',
      AWS_ENDPOINT_URL: 'http://localhost:9005',
      S3_ENDPOINT_URL: 'http://localhost:9005',  // AIDEV-NOTE: Both AWS_ENDPOINT_URL and S3_ENDPOINT_URL needed for different clients
      S3_FORCE_PATH_STYLE: 'true',
      // Skip container management in setup files
      PERSISTENT_TEST_SERVER: 'true'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './')
    }
  }
})