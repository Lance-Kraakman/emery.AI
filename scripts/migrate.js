#!/usr/bin/env node

// Migration wrapper that uses our existing database client parser
const { execSync } = require('child_process');

console.log('Starting database migration...');

try {
  // Import our existing parseConnectionString function
  const { parseConnectionString } = require('../lib/db/client-parser');
  
  // Get DATABASE_URL from environment (this contains JSON from AWS Secrets Manager)
  const rawConnectionString = process.env.DATABASE_URL;
  
  if (!rawConnectionString) {
    throw new Error('DATABASE_URL environment variable not found');
  }

  // Use our existing parser to handle both JSON and connection string formats
  const connectionString = parseConnectionString(rawConnectionString);
  
  // Set the parsed connection string
  process.env.DATABASE_URL = connectionString;
  
  // Run the actual migration
  console.log('🚀 Running Drizzle migrations...');
  execSync('pnpm db:migrate', { 
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: connectionString }
  });
  
  console.log('✅ Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}