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
});

export const db = drizzle(client, { schema });
export { client as rawClient }; // Export raw client for dynamic operations

export type DbClient = typeof db;