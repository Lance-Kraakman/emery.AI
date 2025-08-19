import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Load environment variables only if not already set
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.local' });
}

// AIDEV-NOTE: Import shared parser function
import { parseConnectionString } from './client-parser';

// AIDEV-NOTE: Use dummy connection during build to prevent timeouts
const rawConnectionString = process.env.DATABASE_URL;
if (!rawConnectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const connectionString = parseConnectionString(rawConnectionString);

// AIDEV-NOTE: For build-time dummy URLs, use a very short timeout to fail fast
const isBuildDummyUrl = connectionString.includes('build:build@localhost');
const connectTimeout = isBuildDummyUrl ? 1 : 30; // 1 second for dummy, 30 for real

export const rawClient = postgres(connectionString, {
  max: 5, // Small pool for container environment
  idle_timeout: 30, 
  max_lifetime: 60 * 60,
  connect_timeout: connectTimeout, // Short timeout for build-time dummy URLs
  prepare: false, // Disable prepared statements
  ssl: connectionString.includes('rds.amazonaws.com') ? 'require' : false, // SSL for AWS RDS, none for local Docker
  onnotice: (notice) => {
    if (notice.severity === 'WARNING' || notice.severity === 'NOTICE') {
      console.log(`[POSTGRES-${notice.severity}]:`, notice.message);
    }
  }
});

export const db = drizzle(rawClient, { schema });

export type DbClient = typeof db;

// AIDEV-NOTE: Create dedicated LISTEN/NOTIFY clients with same configuration
export function createNotificationClient(): postgres.Sql {
  const rawConnectionString = process.env.DATABASE_URL;
  if (!rawConnectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  const connectionString = parseConnectionString(rawConnectionString);
  return postgres(connectionString, {
    max: 1, // Only 1 connection for LISTEN/NOTIFY
    idle_timeout: 0, // Keep connection alive for listening
    max_lifetime: 60 * 60, // Close connection after 1 hour
    connect_timeout: 10, // Same timeout as main client
    prepare: false, // Same as main client
    onnotice: (notice) => {
      // Same notice handling as main client
      if (notice.severity === 'WARNING' || notice.severity === 'NOTICE') {
        console.log(`[POSTGRES-NOTIFY-${notice.severity}]:`, notice.message);
      }
    }
  });
}

// AIDEV-NOTE: Connection monitoring utility for debugging connection leaks
export async function getConnectionStats() {
  try {
    const result = await rawClient`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE application_name LIKE 'node%') as node_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `;
    return result[0];
  } catch (error) {
    console.error('[CONNECTION-STATS] Failed to get connection stats:', error);
    return null;
  }
}