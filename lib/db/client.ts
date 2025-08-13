import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Load environment variables
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: '.env.local' });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// AIDEV-NOTE: Create shared postgres client with proper connection pooling to prevent leaks
const client = postgres(connectionString, {
  max: 20, // Maximum 20 connections in pool (within PostgreSQL limit of 100)
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  connect_timeout: 10, // 10 second connection timeout
  prepare: false, // Disable prepared statements to reduce connection overhead
  onnotice: (notice) => {
    // Log PostgreSQL notices for debugging
    if (notice.severity === 'WARNING' || notice.severity === 'NOTICE') {
      console.log(`[POSTGRES-${notice.severity}]:`, notice.message);
    }
  }
});

export const db = drizzle(client, { schema });
export { client as rawClient }; // Export raw client for dynamic operations

export type DbClient = typeof db;

// AIDEV-NOTE: Connection monitoring utility for debugging connection leaks
export async function getConnectionStats() {
  try {
    const result = await client`
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