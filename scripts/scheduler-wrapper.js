#!/usr/bin/env node

/**
 * Scheduler wrapper to fix Node.js module loading issues in Docker
 * This handles the createRequire() issue by setting up the environment properly
 */

// Set up global polyfills for bundled modules
global.globalThis = global.globalThis || global;

// Handle __filename and __dirname for modules that expect them
if (typeof __filename === 'undefined') {
  global.__filename = __filename = process.argv[1] || 'scheduler.js';
}
if (typeof __dirname === 'undefined') {
  global.__dirname = __dirname = process.cwd();
}

// Start the actual scheduler
require('./dist/scheduler.js');