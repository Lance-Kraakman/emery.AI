/**
 * Drizzle ORM Schema for Puck App Builder
 *
 * Copy this to your db/schema.ts file and customize as needed.
 *
 * Usage:
 * 1. Copy to your project: cp src/puck-extraction/schema.drizzle.ts db/schema/puck.ts
 * 2. Import in main schema: export * from './puck'
 * 3. Generate migration: pnpm drizzle-kit generate
 * 4. Run migration: pnpm drizzle-kit migrate
 */

import { pgTable, text, jsonb, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==================== Apps Table ====================

export const puckApps = pgTable("puck_apps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Templates Table ====================

export const puckTemplates = pgTable("puck_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  data: jsonb("data").notNull(), // Puck Data object
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Pages Table ====================

export const puckPages = pgTable("puck_pages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // Route path
  description: text("description"),
  order: integer("order").default(0).notNull(),
  templateId: text("template_id")
    .notNull()
    .references(() => puckTemplates.id, { onDelete: "cascade" }),
  appId: text("app_id")
    .notNull()
    .references(() => puckApps.id, { onDelete: "cascade" }),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Relations ====================

export const appsRelations = relations(puckApps, ({ many }) => ({
  pages: many(puckPages),
}));

export const pagesRelations = relations(puckPages, ({ one }) => ({
  app: one(puckApps, {
    fields: [puckPages.appId],
    references: [puckApps.id],
  }),
  template: one(puckTemplates, {
    fields: [puckPages.templateId],
    references: [puckTemplates.id],
  }),
}));

export const templatesRelations = relations(puckTemplates, ({ many }) => ({
  pages: many(puckPages),
}));

// ==================== Type Exports ====================

export type App = typeof puckApps.$inferSelect;
export type NewApp = typeof puckApps.$inferInsert;

export type Template = typeof puckTemplates.$inferSelect;
export type NewTemplate = typeof puckTemplates.$inferInsert;

export type Page = typeof puckPages.$inferSelect;
export type NewPage = typeof puckPages.$inferInsert;

// ==================== Helper Indexes (Optional) ====================
// Uncomment and add to tables if needed for performance

/*
import { index, uniqueIndex } from "drizzle-orm/pg-core";

// In puckPages table:
  indexes: [
    index("page_app_idx").on(puckPages.appId),
    index("page_slug_idx").on(puckPages.slug),
    uniqueIndex("page_app_slug_idx").on(puckPages.appId, puckPages.slug),
  ]

// In puckApps table:
  indexes: [
    uniqueIndex("app_slug_idx").on(puckApps.slug),
  ]
*/
