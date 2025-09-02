/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'persistent-integration',
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    // NO globalSetup - assumes containers are already running
    testTimeout: 30000,  // Shorter timeout since containers are already running
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