#!/usr/bin/env tsx

// Migration wrapper that uses our existing database client parser
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import { parseConnectionString } from '../lib/db/client-parser';

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
  
  // First, ensure extensions are installed
  console.log('🔧 Installing database extensions...');
  const sql = postgres(connectionString, { 
    max: 1,
    ssl: false,
    connect_timeout: 30
  });
  
  try {
    // Read and execute extension creation script
    const extensionScript = readFileSync(join(__dirname, '../initdb.d/01-create-extensions.sql'), 'utf8');
    const statements = extensionScript
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      console.log(`Executing: ${statement}`);
      await sql.unsafe(statement);
    }
    
    console.log('✅ Extensions installed successfully!');
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