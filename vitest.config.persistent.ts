/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'
 
export default defineConfig({
  test: {
    name: 'persistent-integration',
    environment: 'node',
    setupFiles: ['./src/tests/integration/setup.ts'],
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
    include: ['src/tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Exclude unit test patterns
    exclude: ['__tests__/**/*', 'src/tests/rls/**/*', 'src/tests/unit/**/*'],
    // More concise reporter for faster dev feedback
    reporters: ['basic'],
    // No coverage for fast development testing
    coverage: {
      enabled: false
    },
    // Environment variables for persistent server
    // SECURITY: Credentials loaded from environment, not hardcoded
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || '',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || '',
      TEST_APP_URL: process.env.TEST_APP_URL || 'http://localhost:3002',
      TEST_GRPC_URL: process.env.TEST_GRPC_URL || 'localhost:50053',
      WORKER_ADDRESS: process.env.WORKER_ADDRESS || 'localhost:50053',
      GRPC_TOOLS_ADDRESS: process.env.GRPC_TOOLS_ADDRESS || 'localhost:50054',
      NODE_ENV: 'test',
      HF_TOKEN: process.env.HF_TOKEN || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
      AWS_REGION: process.env.AWS_REGION || 'us-east-1',
      S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'emery-files',
      AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL || '',
      S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL || '',
      S3_FORCE_PATH_STYLE: 'true',
      PERSISTENT_TEST_SERVER: 'true'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src')
    }
  }
})