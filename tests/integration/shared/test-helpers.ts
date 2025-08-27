import { Client } from 'pg';
import { initializeDI } from '@/ddd/application/di/container';
import { db, rawClient } from '@/lib/db/client';
import { organizations, users, userOrganizations, roles, agents, tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { TestCase } from '../../shared/types';

// AIDEV-NOTE: Clean test helpers using Drizzle ORM and environment variables
// Provides minimal, maintainable integration test utilities

export class TestDatabaseClient {
  private dbClient: Client;
  
  constructor() {
    // Use standard DATABASE_URL from .env.local.test
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    this.dbClient = new Client({ connectionString: dbUrl });
  }

  // Direct access to Drizzle instance
  get drizzle() {
    return db;
  }

  async connect(): Promise<void> {
    if (!(this.dbClient as any)._connected) {
      await this.dbClient.connect();
    }
  }

  async disconnect(): Promise<void> {
    if ((this.dbClient as any)._connected) {
      await this.dbClient.end();
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    await this.connect();
    const result = await this.dbClient.query(sql, params);
    return result.rows;
  }

  async cleanTestData(): Promise<void> {
    // Use Drizzle to clean test data
    await db.delete(tasks).where(eq(tasks.organizationId, 1));
    await db.delete(tasks).where(eq(tasks.organizationId, 2));
    await db.delete(agents).where(eq(agents.organizationId, 1));
    await db.delete(agents).where(eq(agents.organizationId, 2));
  }
}

export function initializeTestDI(): void {
  initializeDI(db, rawClient);
}

export const testDb = new TestDatabaseClient();

// Re-export seed functions for convenience
export { seedBasicTestData, seedTestOrganizations, seedTestUsers, seedTestRoles } from './seed-data';