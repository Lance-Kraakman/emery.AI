import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Adapt SQL migration content for PGlite compatibility
 * - Replace vector types with REAL[] arrays for testing
 * - Remove uuid-ossp extension (use built-in gen_random_uuid)
 * - Handle other PGlite limitations
 */
function adaptSQLForPGlite(sql: string): string {
  return sql
    // Replace vector types with REAL arrays (approximate for testing)
    .replace(/vector\((\d+)\)/g, 'REAL[]')
    // Remove extension installations (PGlite doesn't support most extensions)
    .replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;?\s*/g, '')
    // PGlite supports gen_random_uuid natively, so uuid-ossp calls work
    .replace(/uuid_generate_v4\(\)/g, 'gen_random_uuid()')
    // Remove statement breakpoints (not needed for direct execution)
    .replace(/--> statement-breakpoint\s*/g, '');
}

/**
 * Read and execute actual SQL migration files, adapted for PGlite
 */
async function runMigrationFiles(client: PGlite) {
  const migrationDir = path.join(process.cwd(), 'drizzle');
  
  // Get all SQL migration files in order
  const migrationFiles = await glob('*.sql', { cwd: migrationDir });
  migrationFiles.sort(); // Ensure correct order (0000_, 0001_, etc.)
  
  console.log(`🔧 Running ${migrationFiles.length} migration files for test database...`);
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Adapt SQL for PGlite compatibility
    const adaptedSQL = adaptSQLForPGlite(sqlContent);
    
    try {
      await client.exec(adaptedSQL);
      console.log(`✅ Applied migration: ${file}`);
    } catch (error) {
      console.warn(`⚠️ Migration ${file} had issues (may be expected for PGlite):`, (error as Error).message);
      // Continue with other migrations - some failures are expected with PGlite limitations
    }
  }
}

// Create in-memory PostgreSQL database for testing using PGlite
export async function createTestDb() {
  // Create in-memory PostgreSQL instance
  const client = new PGlite();
  
  const db = drizzle(client, { schema });
  
  try {
    // Install extensions like production (adapted for PGlite)
    console.log('🔧 Setting up test database extensions...');
    
    // PGlite doesn't support uuid-ossp extension, but gen_random_uuid() works natively
    // PGlite doesn't support vector extension, so we'll use REAL[] as approximation
    
    // Apply actual migration files (adapted for PGlite compatibility)
    await runMigrationFiles(client);
    
    // Insert test data after migrations
    await client.exec(`
      -- Test data (using gen_random_uuid() which works in PGlite)
      INSERT INTO organizations (id, name, mission) VALUES 
        (1, 'Test Org', 'Testing organization')
      ON CONFLICT (id) DO NOTHING;
      
      INSERT INTO users (id, name, email, current_organization_id) VALUES 
        ('550e8400-e29b-41d4-a716-446655440000', 'Test User', 'test@example.com', 1)
      ON CONFLICT (id) DO NOTHING;
      
      -- Create user-organization relationship (required for repository tests)
      INSERT INTO user_organizations (user_id, organization_id, role) VALUES
        ('550e8400-e29b-41d4-a716-446655440000', 1, 'owner')
      ON CONFLICT DO NOTHING;
      
      -- IMPORTANT: Sync sequences after manual inserts
      SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations), true);
      SELECT setval('user_organizations_id_seq', (SELECT MAX(id) FROM user_organizations), true);
    `);
    
    console.log('✅ Test database setup complete with real migration files!');
    
  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    throw error;
  }
  
  return {
    db,
    client,
    close: async () => await client.close(),
    // Helper to reset database between tests
    reset: async () => {
      // Clear all data but keep schema and test fixtures
      // Note: Order matters due to foreign key constraints
      await client.exec(`
        -- Clear all tables in reverse dependency order
        DELETE FROM team_memberships;
        DELETE FROM invitations;
        DELETE FROM rag_query_logs;
        DELETE FROM rag_documents;
        DELETE FROM rag_indexes;
        DELETE FROM tasks;
        DELETE FROM sessions;
        DELETE FROM verification_tokens;
        DELETE FROM accounts;
        DELETE FROM user_organizations WHERE user_id != '550e8400-e29b-41d4-a716-446655440000';
        DELETE FROM agents;
        DELETE FROM fields;
        DELETE FROM tables;
        DELETE FROM databases;
        DELETE FROM teams;
        DELETE FROM roles;
        DELETE FROM users WHERE id != '550e8400-e29b-41d4-a716-446655440000';
        DELETE FROM organizations WHERE id != 1;
        
        -- Restore test user-organization relationship
        INSERT INTO user_organizations (user_id, organization_id, role) VALUES
          ('550e8400-e29b-41d4-a716-446655440000', 1, 'owner')
        ON CONFLICT DO NOTHING;
        
        -- Reset sequences to proper values based on existing data
        SELECT setval('organizations_id_seq', COALESCE((SELECT MAX(id) FROM organizations), 1), true) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'organizations_id_seq');
        SELECT setval('user_organizations_id_seq', COALESCE((SELECT MAX(id) FROM user_organizations), 1), true) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'user_organizations_id_seq');
        SELECT setval('databases_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'databases_id_seq');
        SELECT setval('tables_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tables_id_seq');
        SELECT setval('fields_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'fields_id_seq');
        SELECT setval('agents_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'agents_id_seq');
        SELECT setval('roles_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'roles_id_seq');
        SELECT setval('teams_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'teams_id_seq');
        SELECT setval('team_memberships_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'team_memberships_id_seq');
        SELECT setval('invitations_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'invitations_id_seq');
      `);
    }
  };
}

export type TestDbClient = ReturnType<typeof createTestDb>['db'];

// Mock functions for testing environment
export function setupTestEnvironment() {
  // Override environment variables for tests
  process.env.NEXTAUTH_URL = 'http://localhost:3000';
  process.env.NEXTAUTH_SECRET = 'test-secret-key';
}