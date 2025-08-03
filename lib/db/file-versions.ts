import { pgTable, serial, uuid, integer, jsonb, timestamp, boolean, text } from "drizzle-orm/pg-core";

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

export type FileVersion = typeof fileVersions.$inferSelect;
export type NewFileVersion = typeof fileVersions.$inferInsert;