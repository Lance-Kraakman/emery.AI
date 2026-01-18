#!/usr/bin/env tsx

// Migration wrapper that uses our existing database client parser
import { execSync } from 'child_process';
import postgres from 'postgres';
import { parseConnectionString } from '@/ddd/infrastructure/db/client-parser';
  // Import and run seeds in order
import { seedPermissions, seedSystemRoles } from '../drizzle/seeds/rbac.js';
import { seedSystemUsers } from '../drizzle/seeds/system-users.js';
import { seedSystemRoleAssignments } from '../drizzle/seeds/system-role-assignments.js';
import { seedAppTypes } from '../drizzle/seeds/app-types.js';
import { seedTools } from '../drizzle/seeds/tools.js';
import { seedSystemTemplates } from '@/drizzle/seeds/default-templates';

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

    // Always run seeds - they are idempotent (dedupe + existence checks)
    console.log('\n🌱 Running database seed scripts...');

    try {
      console.log('  📋 Seeding RBAC (permissions and roles)...');
      await seedPermissions();
      await seedSystemRoles();

      console.log('  👤 Seeding system users...');
      await seedSystemUsers();

      console.log('  🔐 Seeding system role assignments...');
      await seedSystemRoleAssignments();

      console.log('  📦 Seeding app types...');
      await seedAppTypes();

      console.log('  🛠️  Seeding tools...');
      await seedTools();

      // DEPRECATED: System skills are now replaced by builtin templates
      // Users can apply templates from the template library instead
      // console.log('  🤖 Seeding system skills...');
      // await seedSystemSkills();

      console.log('  🎨 Seeding puck templates...');
      await seedSystemTemplates();

      console.log('✅ Database seeding completed successfully!');
    } catch (seedError) {
      console.error('❌ Seeding failed:', (seedError as Error).message);
      console.error('Note: Migration succeeded, but seeding failed');
      // Don't exit with error - migration succeeded
    }

    // Explicitly exit to close database connections and terminate container
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', (error as Error).message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runMigration();
}