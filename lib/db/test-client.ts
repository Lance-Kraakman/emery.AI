import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export async function createTestDb() {
  const client = postgres({
    host: '127.0.0.1',
    port: 5434,
    user: 'postgres',
    password: 'test_password',
    database: 'emery_test',
    max: 1,
  });

  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: 'drizzle' });

  return {
    db,
    client,
    close: async () => await client.end(),
  };
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
export type TestDbClient = TestDb['db'];
