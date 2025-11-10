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

    // Run seed scripts if RUN_SEEDS environment variable is set
    const runSeeds = process.env.RUN_SEEDS?.toLowerCase() === 'true';

    if (runSeeds) {
      console.log('\n🌱 Running database seed scripts...');

      try {
        // Import and run seeds in order
        const { seedPermissions, seedSystemRoles } = await import('../drizzle/seeds/rbac.js');
        const { seedSystemUsers } = await import('../drizzle/seeds/system-users.js');
        const { seedSystemRoleAssignments } = await import('../drizzle/seeds/system-role-assignments.js');
        const { seedAppTypes } = await import('../drizzle/seeds/app-types.js');
        const { seedTools } = await import('../drizzle/seeds/tools.js');

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

        console.log('✅ Database seeding completed successfully!');
      } catch (seedError) {
        console.error('❌ Seeding failed:', (seedError as Error).message);
        console.error('Note: Migration succeeded, but seeding failed');
        // Don't exit with error - migration succeeded
      }
    } else {
      console.log('ℹ️  Skipping seeds (set RUN_SEEDS=true to enable)');
    }

  } catch (error) {
    console.error('❌ Migration failed:', (error as Error).message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  runMigration();
}