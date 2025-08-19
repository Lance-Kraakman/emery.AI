#!/usr/bin/env node

// Migration wrapper that converts AWS Secrets Manager JSON to DATABASE_URL
const { execSync } = require('child_process');

console.log('Starting database migration...');

try {
  // Get DATABASE_URL from environment (this contains JSON from AWS Secrets Manager)
  const databaseCredentials = process.env.DATABASE_URL;
  
  if (!databaseCredentials) {
    throw new Error('DATABASE_URL environment variable not found');
  }

  let connectionString;
  
  try {
    // Try to parse as JSON first (AWS Secrets Manager format)
    const credentials = JSON.parse(databaseCredentials);
    const { username, password, host, port, dbname } = credentials;
    
    if (!username || !password || !host || !port || !dbname) {
      throw new Error('Missing required database credentials in JSON');
    }
    
    // Construct PostgreSQL connection string
    connectionString = `postgresql://${username}:${password}@${host}:${port}/${dbname}`;
    console.log(`✅ Parsed database credentials from AWS Secrets Manager`);
    console.log(`   Host: ${host}`);
    console.log(`   Database: ${dbname}`);
    console.log(`   User: ${username}`);
    
  } catch (parseError) {
    // If it's not JSON, assume it's already a connection string
    connectionString = databaseCredentials;
    console.log('✅ Using DATABASE_URL as connection string');
  }

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