import { pgTable, text, uuid, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const fileVersions = pgTable("file_versions", {
  id: serial("id").primaryKey(),
  fileId: uuid("file_id").notNull(), // References the file UUID from JSONB metadata
  versionNumber: integer("version_number").notNull(),
  content: jsonb("content").notNull(), // Tiptap document JSON
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: uuid("created_by"), // User who created this version
  isCurrent: boolean("is_current").default(false),
  changeSummary: text("change_summary"), // Optional: description of changes
});