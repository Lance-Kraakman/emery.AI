# Apps, Pages & Templates Architecture

This document describes the hierarchical structure for organizing Puck templates.

## Overview

The system uses a three-level hierarchy:

```
App → Pages → Templates
```

- **App**: Top-level container for a project (e.g., "Marketing Site", "Customer Portal")
- **Page**: A routable page within an app (e.g., "/about", "/pricing")
- **Template**: The actual Puck template/document that renders the page content

## Data Structure

### App

```typescript
type PuckApp = {
  id: string;
  name: string;              // Display name
  slug: string;              // URL-friendly identifier
  description?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

**Example:**
```json
{
  "id": "app-1",
  "name": "Marketing Website",
  "slug": "marketing",
  "description": "Public-facing marketing site"
}
```

### Page

```typescript
type PuckPage = {
  id: string;
  name: string;              // Display name
  slug: string;              // Route path (e.g., "/about", "/products/pricing")
  description?: string;
  order: number;             // For ordering in navigation
  templateId: string;        // Reference to template
  appId: string;             // Reference to parent app
  isPublished: boolean;      // Publish status
  createdAt: Date;
  updatedAt: Date;
};
```

**Example:**
```json
{
  "id": "page-1",
  "name": "About Us",
  "slug": "/about",
  "description": "Company information",
  "order": 1,
  "templateId": "template-1",
  "appId": "app-1",
  "isPublished": true
}
```

### Template

```typescript
type PuckTemplate = {
  id: string;
  name: string;              // Display name
  slug: string;              // Identifier
  data: Data;                // Puck Data object (JSON)
  createdAt: Date;
  updatedAt: Date;
};
```

**Example:**
```json
{
  "id": "template-1",
  "name": "About Page Template",
  "slug": "about-template",
  "data": {
    "content": [
      {
        "type": "Heading",
        "props": { "text": "About Us", "type": "h1" }
      }
    ],
    "root": {},
    "zones": {}
  }
}
```

## Database Schema (Drizzle)

See `schema.drizzle.ts` for the complete schema definition.

```typescript
// Apps table
export const puckApps = pgTable("puck_apps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Templates table
export const puckTemplates = pgTable("puck_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pages table (references both apps and templates)
export const puckPages = pgTable("puck_pages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  order: integer("order").default(0).notNull(),
  templateId: text("template_id")
    .references(() => puckTemplates.id, { onDelete: "cascade" }),
  appId: text("app_id")
    .references(() => puckApps.id, { onDelete: "cascade" }),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## Usage Patterns

### 1. Creating a New App with Pages

```typescript
import { db } from "@/db";
import { puckApps, puckTemplates, puckPages } from "@/db/schema";

// 1. Create the app
const [app] = await db.insert(puckApps).values({
  name: "Marketing Website",
  slug: "marketing",
  description: "Public marketing site",
}).returning();

// 2. Create templates
const [homeTemplate] = await db.insert(puckTemplates).values({
  name: "Home Page Template",
  slug: "home",
  data: { content: [], root: {}, zones: {} },
}).returning();

const [aboutTemplate] = await db.insert(puckTemplates).values({
  name: "About Page Template",
  slug: "about",
  data: { content: [], root: {}, zones: {} },
}).returning();

// 3. Create pages
await db.insert(puckPages).values([
  {
    name: "Home",
    slug: "/",
    appId: app.id,
    templateId: homeTemplate.id,
    order: 0,
    isPublished: true,
  },
  {
    name: "About",
    slug: "/about",
    appId: app.id,
    templateId: aboutTemplate.id,
    order: 1,
    isPublished: true,
  },
]);
```

### 2. Fetching App with Pages

```typescript
const app = await db.query.puckApps.findFirst({
  where: eq(puckApps.slug, "marketing"),
  with: {
    pages: {
      with: {
        template: true,
      },
      orderBy: (pages, { asc }) => [asc(pages.order)],
    },
  },
});

// Result structure:
// {
//   id: "app-1",
//   name: "Marketing Website",
//   slug: "marketing",
//   pages: [
//     {
//       id: "page-1",
//       name: "Home",
//       slug: "/",
//       template: {
//         id: "template-1",
//         name: "Home Page Template",
//         data: { ... },
//       },
//     },
//     // ...
//   ],
// }
```

### 3. Rendering a Page

```typescript
// In your page component:
import { Render } from "@measured/puck";
import { config } from "@/puck-extraction/components/config";

export default async function Page({ params }) {
  const { appSlug, pageSlug } = params;

  // Fetch the app
  const app = await db.query.puckApps.findFirst({
    where: eq(puckApps.slug, appSlug),
  });

  if (!app) return notFound();

  // Fetch the page with template
  const page = await db.query.puckPages.findFirst({
    where: and(
      eq(puckPages.appId, app.id),
      eq(puckPages.slug, `/${pageSlug}`)
    ),
    with: {
      template: true,
    },
  });

  if (!page) return notFound();

  return <Render config={config} data={page.template.data} />;
}
```

### 4. Editing a Page

```typescript
"use client";

import { Puck } from "@measured/puck";
import { config } from "@/puck-extraction/components/config";

export default function Editor({ pageId }) {
  const [page, setPage] = useState(null);

  useEffect(() => {
    // Fetch page with template
    fetch(`/api/puck/pages/${pageId}`)
      .then((res) => res.json())
      .then(setPage);
  }, [pageId]);

  const handleSave = async (data) => {
    // Update the template
    await fetch(`/api/puck/templates/${page.templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
  };

  if (!page) return <div>Loading...</div>;

  return (
    <Puck
      config={config}
      data={page.template.data}
      onPublish={handleSave}
    />
  );
}
```

## Demo Routes

The demo implementation uses localStorage and is available at:

- `/puck-demo` - List all apps
- `/puck-demo/[app_slug]` - View app and its pages
- `/puck-demo/[app_slug]/[page_slug]` - View rendered page
- `/puck-demo/[app_slug]/[page_slug]/edit` - Edit page template

### Demo Features

- ✅ Create/delete apps
- ✅ Create/delete pages within apps
- ✅ Edit page templates with Puck editor
- ✅ View rendered pages
- ✅ LocalStorage persistence (no database required)
- ✅ Auto-initialization with demo data

## API Routes

Example API route structure (see `api-examples/` directory):

```
app/api/puck/
├── apps/
│   ├── route.ts              # GET (list), POST (create)
│   └── [id]/
│       └── route.ts          # GET (single), PUT (update), DELETE
├── pages/
│   ├── route.ts              # GET (list by appId), POST (create)
│   └── [id]/
│       └── route.ts          # GET (single), PUT (update), DELETE
└── templates/
    ├── route.ts              # GET (list), POST (create)
    └── [id]/
        └── route.ts          # GET (single), PUT (update), DELETE
```

## Navigation Building

Generate navigation from apps and pages:

```typescript
export async function getAppNavigation(appId: string) {
  const pages = await db.query.puckPages.findMany({
    where: and(
      eq(puckPages.appId, appId),
      eq(puckPages.isPublished, true)
    ),
    orderBy: (pages, { asc }) => [asc(pages.order)],
  });

  return pages.map(page => ({
    id: page.id,
    name: page.name,
    slug: page.slug,
    order: page.order,
  }));
}
```

## Best Practices

### 1. Template Reuse

You CAN reuse templates across multiple pages:

```typescript
// Create one template
const [sharedTemplate] = await db.insert(puckTemplates).values({
  name: "Standard Page Template",
  slug: "standard",
  data: { /* ... */ },
}).returning();

// Use it for multiple pages
await db.insert(puckPages).values([
  {
    name: "About",
    slug: "/about",
    templateId: sharedTemplate.id,
    appId: app.id,
  },
  {
    name: "Contact",
    slug: "/contact",
    templateId: sharedTemplate.id, // Same template!
    appId: app.id,
  },
]);
```

**Note:** If pages share a template and you edit one, it affects ALL pages using that template. If you want independent content, create separate templates.

### 2. Page Ordering

Use the `order` field for navigation:

```typescript
await db.insert(puckPages).values([
  { name: "Home", slug: "/", order: 0, ... },
  { name: "About", slug: "/about", order: 1, ... },
  { name: "Contact", slug: "/contact", order: 2, ... },
]);

// Fetch in order:
const pages = await db.query.puckPages.findMany({
  where: eq(puckPages.appId, appId),
  orderBy: (pages, { asc }) => [asc(pages.order)],
});
```

### 3. Publish Workflow

Use `isPublished` for draft/publish workflow:

```typescript
// Create as draft
const [page] = await db.insert(puckPages).values({
  name: "New Feature",
  slug: "/new-feature",
  isPublished: false, // Draft
  ...
}).returning();

// Edit and test...

// Publish when ready
await db.update(puckPages)
  .set({ isPublished: true })
  .where(eq(puckPages.id, page.id));
```

### 4. Slug Patterns

Common slug patterns:

```typescript
// Homepage
{ slug: "/" }

// Top-level pages
{ slug: "/about" }
{ slug: "/contact" }
{ slug: "/pricing" }

// Nested pages
{ slug: "/products/pricing" }
{ slug: "/blog/post-title" }
{ slug: "/docs/getting-started" }
```

## Migration from localStorage to Database

If you're using the demo and want to migrate to a real database:

1. Copy `schema.drizzle.ts` to your `db/schema` directory
2. Run `pnpm drizzle-kit generate`
3. Run `pnpm drizzle-kit migrate`
4. Replace `utils/storage.ts` functions with database queries
5. Update demo routes to use API routes instead of direct storage calls

Example migration:

```typescript
// Before (localStorage):
import { getAppWithPagesBySlug } from "@/puck-extraction/utils/storage";
const app = getAppWithPagesBySlug(appSlug);

// After (database):
import { db } from "@/db";
import { puckApps } from "@/db/schema";
const app = await db.query.puckApps.findFirst({
  where: eq(puckApps.slug, appSlug),
  with: {
    pages: {
      with: { template: true },
    },
  },
});
```

## Summary

The Apps/Pages/Templates structure provides:

- **Organization**: Group related pages into apps
- **Flexibility**: Reuse templates or make unique ones
- **Routing**: Map pages to URL routes
- **Navigation**: Build menus from page order
- **Workflow**: Draft/publish with `isPublished` flag
- **Scalability**: Support multiple apps in one system

See the demo at `/puck-demo` for a working example!
