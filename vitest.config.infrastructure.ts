/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'infrastructure',
    environment: 'node',
    // setupFiles: ['./tests/integration/setup.ts'],  // Disabled due to testClient hanging issue
    globalSetup: ['./tests/integration/infrastructure-global-setup.ts'],
    testTimeout: 90000,  // 90s for container operations and API calls
    hookTimeout: 120000, // 2min for setup/teardown with containers
    poolOptions: {
      threads: {
        singleThread: true // Sequential execution for container tests
      }
    },
    // Ensure clean state between test runs
    isolate: true,
    // Retry flaky container tests once
    retry: 1,
    // Include infrastructure and clean service integration tests
    include: [
      'tests/integration/infrastructure/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/services/clean-*.integration.test.ts'
    ],
    // Exclude problematic application tests
    exclude: [
      '__tests__/**/*', 
      'tests/rls/**/*', 
      'tests/unit/**/*',
      'tests/integration/api/**/*',
      'tests/integration/e2e/**/*'
    ],
    // Custom reporters for integration test output
    reporters: ['verbose']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './')
    }
  }
})