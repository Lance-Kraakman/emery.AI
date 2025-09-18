#!/usr/bin/env tsx
/**
 * Test Server Wrapper Script
 * 
 * Minimal wrapper to expose test infrastructure commands for development use.
 * Delegates to shared test-infrastructure module to avoid code duplication.
 * 
 * AIDEV-NOTE: This allows developers to start/stop test servers manually
 * while reusing the exact same logic as CI tests.
 */

import { startTestContainers, stopTestContainers } from '../src/tests/integration/shared/test-infrastructure';

async function main() {
  const command = process.argv[2];
  
  try {
    switch (command) {
      case 'start':
        await startTestContainers();
        console.log('\n🧪 Run tests with: pnpm test:integration:dev');
        break;
        
      case 'stop':
        await stopTestContainers();
        break;
        
      default:
        console.log('🧪 Test Server Management');
        console.log('\nUsage:');
        console.log('  pnpm test:integration:server  - Start test infrastructure');
        console.log('  pnpm test:integration:stop    - Stop test infrastructure');
        console.log('  pnpm test:integration:dev     - Run tests against running server');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}