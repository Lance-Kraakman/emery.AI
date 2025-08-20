import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import fs from 'fs';
import path from 'path';

// Create in-memory PostgreSQL database for testing using PGlite
export async function createTestDb() {
  // Create in-memory PostgreSQL instance
  const client = new PGlite();
  
  const db = drizzle(client, { schema });
  
  // Create basic schema for testing
  // PGlite doesn't support all extensions, so we'll use simpler UUID generation
  await client.exec(`
    -- Organizations table (matches your schema)
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mission TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Users table (using TEXT for UUID since PGlite may not support full UUID functions)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      current_organization_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tables table (dynamic tables metadata)
    CREATE TABLE IF NOT EXISTS tables (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      organization_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Fields table (matches your field system)
    CREATE TABLE IF NOT EXISTS fields (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      table_id INTEGER REFERENCES tables(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Agents table (for agent tests)
    CREATE TABLE IF NOT EXISTS agents (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization_id INTEGER REFERENCES organizations(id),
      owner_id TEXT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Test data
    INSERT INTO organizations (id, name, mission) VALUES 
      (1, 'Test Org', 'Testing organization')
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO users (id, name, email, current_organization_id) VALUES 
      ('550e8400-e29b-41d4-a716-446655440000', 'Test User', 'test@example.com', 1)
    ON CONFLICT (id) DO NOTHING;
  `);
  
  return {
    db,
    client,
    close: async () => await client.close(),
    // Helper to reset database between tests
    reset: async () => {
      // Clear all data but keep schema and test fixtures
      await client.exec(`
        DELETE FROM agents;
        DELETE FROM fields;
        DELETE FROM tables;
        DELETE FROM users WHERE id != '550e8400-e29b-41d4-a716-446655440000';
        DELETE FROM organizations WHERE id != 1;
        
        -- Reset sequences (use IF EXISTS to handle PGlite differences)
        SELECT setval('organizations_id_seq', 2, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'organizations_id_seq');
        SELECT setval('tables_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tables_id_seq');
        SELECT setval('fields_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'fields_id_seq');
        SELECT setval('agents_id_seq', 1, false) WHERE EXISTS (SELECT 1 FROM pg_class WHERE relname = 'agents_id_seq');
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