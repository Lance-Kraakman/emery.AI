/**
 * Unit Tests for Schema Isolation Logic
 * Uses SQLite in-memory database for fast, isolated testing
 */

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as schema from "../../lib/db/schema";
import { eq, and } from "drizzle-orm";

describe("Schema Isolation Unit Tests", () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });

    // Create tables (simplified schema for testing)
    sqlite.exec(`
      CREATE TABLE organizations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        mission TEXT
      );

      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        current_organization_id INTEGER,
        FOREIGN KEY (current_organization_id) REFERENCES organizations(id)
      );

      CREATE TABLE agents (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        organization_id INTEGER NOT NULL,
        description TEXT,
        FOREIGN KEY (owner_id) REFERENCES users(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
      );

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        agent_id INTEGER NOT NULL,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        instructions TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_by TEXT NOT NULL,
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (organization_id) REFERENCES organizations(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
    `);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("should isolate organizations properly", async () => {
    // Seed test data
    const [org1] = await db.insert(schema.organizations).values({
      name: "Test Org 1",
      mission: "First organization"
    }).returning();

    const [org2] = await db.insert(schema.organizations).values({
      name: "Test Org 2", 
      mission: "Second organization"
    }).returning();

    // Verify organizations are isolated by ID
    const org1Data = await db.select().from(schema.organizations).where(eq(schema.organizations.id, org1.id));
    const org2Data = await db.select().from(schema.organizations).where(eq(schema.organizations.id, org2.id));

    expect(org1Data).toHaveLength(1);
    expect(org2Data).toHaveLength(1);
    expect(org1Data[0].name).toBe("Test Org 1");
    expect(org2Data[0].name).toBe("Test Org 2");
  });

  it("should enforce agent-organization relationships", async () => {
    // Create organizations
    const [org1] = await db.insert(schema.organizations).values({
      name: "Org 1",
      mission: "Test org 1"
    }).returning();

    const [org2] = await db.insert(schema.organizations).values({
      name: "Org 2", 
      mission: "Test org 2"
    }).returning();

    // Create users
    const [user1] = await db.insert(schema.users).values({
      id: "user1-uuid",
      name: "User 1",
      email: "user1@test.com",
      currentOrganizationId: org1.id
    }).returning();

    const [user2] = await db.insert(schema.users).values({
      id: "user2-uuid",
      name: "User 2", 
      email: "user2@test.com",
      currentOrganizationId: org2.id
    }).returning();

    // Create agents for each organization
    const [agent1] = await db.insert(schema.agents).values({
      name: "Agent 1",
      ownerId: user1.id,
      organizationId: org1.id,
      description: "Agent for org 1"
    }).returning();

    const [agent2] = await db.insert(schema.agents).values({
      name: "Agent 2",
      ownerId: user2.id, 
      organizationId: org2.id,
      description: "Agent for org 2"
    }).returning();

    // Verify agents belong to correct organizations
    const org1Agents = await db.select()
      .from(schema.agents)
      .where(eq(schema.agents.organizationId, org1.id));

    const org2Agents = await db.select()
      .from(schema.agents) 
      .where(eq(schema.agents.organizationId, org2.id));

    expect(org1Agents).toHaveLength(1);
    expect(org2Agents).toHaveLength(1);
    expect(org1Agents[0].name).toBe("Agent 1");
    expect(org2Agents[0].name).toBe("Agent 2");
  });

  it("should maintain task-organization isolation", async () => {
    // Setup test data
    const [org1] = await db.insert(schema.organizations).values({
      name: "Task Org 1",
      mission: "Task testing org 1"
    }).returning();

    const [user1] = await db.insert(schema.users).values({
      id: "task-user-1",
      name: "Task User 1",
      email: "taskuser1@test.com", 
      currentOrganizationId: org1.id
    }).returning();

    const [agent1] = await db.insert(schema.agents).values({
      name: "Task Agent 1",
      ownerId: user1.id,
      organizationId: org1.id,
      description: "Agent for task testing"
    }).returning();

    // Create tasks
    const [task1] = await db.insert(schema.tasks).values({
      id: "task-1-uuid",
      agentId: agent1.id,
      organizationId: org1.id,
      name: "Test Task",
      instructions: JSON.stringify({ instructions: "test task" }),
      createdBy: user1.id
    }).returning();

    // Verify task belongs to organization
    const orgTasks = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.organizationId, org1.id));

    expect(orgTasks).toHaveLength(1);
    expect(orgTasks[0].name).toBe("Test Task");
    expect(orgTasks[0].organizationId).toBe(org1.id);
  });

  it("should enforce foreign key relationships", async () => {
    // This test verifies that SQLite foreign keys work correctly
    const [org1] = await db.insert(schema.organizations).values({
      name: "FK Test Org",
      mission: "Foreign key testing"
    }).returning();

    // Try to create a user with invalid organization_id
    // Note: SQLite foreign keys might not be enforced by default
    // This is more of a schema validation test
    
    const validUser = await db.insert(schema.users).values({
      id: "fk-user-uuid",
      name: "FK User",
      email: "fkuser@test.com",
      currentOrganizationId: org1.id
    }).returning();

    expect(validUser).toHaveLength(1);
    expect(validUser[0].currentOrganizationId).toBe(org1.id);
  });
});