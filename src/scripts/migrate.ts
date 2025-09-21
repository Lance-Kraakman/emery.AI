#!/usr/bin/env tsx

// Migration wrapper that uses our existing database client parser
import { execSync } from 'child_process';
import postgres from 'postgres';
import { parseConnectionString } from '../lib/db/client-parser';

async function runMigration() {
  console.log('Starting database migration...');

  try {
    // Get DATABASE_URL from environment (this contains JSON from AWS Secrets Manager)
    const rawConnectionString = process.env.DATABASE_URL;
    
    if (!rawConnectionString) {
      throw new Error('DATABASE_URL environment variable not found');
    }

    // Use our existing parser to handle both JSON and connection string formats
    const connectionString = parseConnectionString(rawConnectionString);
    
    // Set the parsed connection string
    process.env.DATABASE_URL = connectionString;
    
    // First, create required extensions
    console.log('🔧 Creating database extensions...');
    const sql = postgres(connectionString, { 
      max: 1,
      ssl: false,
      connect_timeout: 30
    });
    
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      await sql`CREATE EXTENSION IF NOT EXISTS "vector"`;
      console.log('✅ Extensions created successfully!');
    } finally {
      await sql.end();
    }
    
    // Run the actual migration
    console.log('🚀 Running Drizzle migrations...');
    execSync('pnpm db:migrate', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: connectionString }
    });
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', (error as Error).message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runMigration();
}