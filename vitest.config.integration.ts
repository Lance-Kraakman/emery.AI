/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    setupFiles: ['./tests/integration/setup.ts'],
    globalSetup: ['./tests/integration/global-setup.ts'],
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
    // Include integration tests only
    include: ['tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Exclude unit test patterns  
    exclude: ['__tests__/**/*', 'tests/rls/**/*', 'tests/unit/**/*'],
    // Custom reporters for integration test output
    reporters: ['verbose'],
    // Coverage configuration for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/integration',
      include: [
        'app/**/*.{js,ts,tsx}',
        'lib/**/*.{js,ts}',
        'ddd/**/*.{js,ts}',
        'scripts/**/*.{js,ts}'
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/node_modules/**',
        '**/.next/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/tests/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '~': path.resolve(__dirname, './')
    }
  }
})