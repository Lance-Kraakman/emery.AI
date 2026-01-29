#!/usr/bin/env tsx
/**
 * Fetch Pipedream Tools with Environment
 *
 * Loads .env.local then runs the fetch script.
 *
 * Usage: pnpm tsx src/scripts/fetch-pipedream-tools-with-env.ts
 */

import { config } from 'dotenv';
import path from 'path';
import { spawn } from 'child_process';

// Load .env.local from project root
config({ path: path.join(process.cwd(), '.env.local') });

// Run the fetch script
const child = spawn('pnpm', ['tsx', 'src/scripts/fetch-pipedream-tools.ts'], {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
