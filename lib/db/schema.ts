import { pgTable, text, uuid, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tables = pgTable("tables", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),
  name: text("name").notNull(),
  dbName: text("db_name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fields = pgTable("fields", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  type: text("type").notNull(), // text, number, boolean, email, url, date, relation
  orderIndex: integer("order_index").default(0),
  relatedTableId: integer("related_table_id").references(() => tables.id),
  required: boolean("required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  organizationId: integer("organization_id").references(() => organizations.id),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mission: text("mission"),
  sharedTools: text("shared_tools").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  purpose: text("purpose"),
  description: text("description"),
  responsibilities: text("responsibilities").array(),
  goals: text("goals").array(),
  tools: text("tools").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  capabilities: text("capabilities").array(),
  status: text("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  permissions: text("permissions").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMemberships = pgTable("team_memberships", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  principalType: text("principal_type").notNull(),
  principalId: text("principal_id").notNull(),
  roleId: integer("role_id").references(() => roles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const databaseAcl = pgTable("database_acl", {
  id: serial("id").primaryKey(),
  databaseId: integer("database_id").notNull().references(() => workspaces.id),
  principalType: text("principal_type").notNull(),
  principalId: text("principal_id").notNull(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tableAcl = pgTable("table_acl", {
  id: serial("id").primaryKey(),
  tableId: integer("table_id").notNull().references(() => tables.id),
  principalType: text("principal_type").notNull(),
  principalId: text("principal_id").notNull(),
  roleId: integer("role_id").notNull().references(() => roles.id),
  createdAt: timestamp("created_at").defaultNow(),
});