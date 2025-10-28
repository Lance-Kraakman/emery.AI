# Migration Guide

Quick checklist for moving this package to your new repo.

## ✅ Checklist

### 1. Copy Files

```bash
# From dashlet repo
cp -r puck-extraction /path/to/new-repo/src/

# Or rename if you prefer
cp -r puck-extraction /path/to/new-repo/src/puck-builder
```

### 2. Install Dependencies

```bash
cd /path/to/new-repo
pnpm add @measured/puck@0.18.3 react-markdown
pnpm add lexical @lexical/react @lexical/list @lexical/rich-text @lexical/link @lexical/selection @lexical/utils
```

### 3. Test the Demo (Optional)

If you copied the demo routes (`src/app/puck-demo`):

```bash
pnpm dev
# Navigate to http://localhost:3000/puck-demo
```

Test creating, editing, and viewing templates.

### 4. Set Up Database Schema

Using Drizzle ORM:

```typescript
// db/schema.ts
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const puckTemplates = pgTable("puck_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  data: jsonb("data").notNull(), // Puck Data object
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const puckPages = pgTable("puck_pages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  templateIds: jsonb("template_ids").$type<string[]>(), // Array of template IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

Run migration:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 5. Create API Routes

```typescript
// app/api/puck/templates/route.ts
import { db } from "@/db";
import { puckTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const templates = await db.select().from(puckTemplates);
  return Response.json(templates);
}

export async function POST(req: Request) {
  const body = await req.json();

  const [template] = await db.insert(puckTemplates).values({
    name: body.name,
    slug: body.slug,
    data: body.data,
  }).returning();

  return Response.json(template);
}

// app/api/puck/templates/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const template = await db.query.puckTemplates.findFirst({
    where: eq(puckTemplates.id, params.id),
  });

  if (!template) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(template);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();

  const [updated] = await db
    .update(puckTemplates)
    .set({
      data: body.data,
      updatedAt: new Date(),
    })
    .where(eq(puckTemplates.id, params.id))
    .returning();

  return Response.json(updated);
}
```

### 6. Create Editor Route

```typescript
// app/builder/[id]/edit/page.tsx
"use client";

import { Puck, Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    // Load template
    fetch(`/api/puck/templates/${params.id}`)
      .then((res) => res.json())
      .then((template) => setData(template.data));
  }, [params.id]);

  const handleSave = async (data: Data) => {
    await fetch(`/api/puck/templates/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    router.push(`/builder/${params.id}`);
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div style={{ height: "100vh" }}>
      <Puck config={config} data={data} onPublish={handleSave} />
    </div>
  );
}
```

### 7. Create Viewer Route

```typescript
// app/builder/[id]/page.tsx
import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
import { db } from "@/db";
import { puckTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";

export default async function ViewerPage({ params }: { params: { id: string } }) {
  const template = await db.query.puckTemplates.findFirst({
    where: eq(puckTemplates.id, params.id),
  });

  if (!template) {
    return <div>Template not found</div>;
  }

  return (
    <div>
      <div style={{ padding: "16px", borderBottom: "1px solid #ddd" }}>
        <Link href={`/builder/${params.id}/edit`}>Edit</Link>
      </div>
      <Render config={config} data={template.data as Data} />
    </div>
  );
}
```

### 8. Update tsconfig Paths (if needed)

If you renamed the folder or want cleaner imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@/puck/*": ["./src/puck-extraction/*"],
      // or
      "@/puck-builder/*": ["./src/puck-builder/*"]
    }
  }
}
```

Then use:

```typescript
import { config } from "@/puck/components/config";
```

### 9. Add Global Styles

Add to your global CSS file:

```css
/* Import Puck styles */
@import "@measured/puck/puck.css";

/* Optional: Customize Puck colors */
:root {
  --puck-color-grey-01: #f9fafb;
  --puck-color-grey-02: #f3f4f6;
  --puck-color-grey-03: #e5e7eb;
  --puck-color-grey-04: #d1d5db;
  --puck-color-grey-05: #6b7280;
  --puck-color-azure-04: #3b82f6;
  --puck-color-azure-05: #2563eb;
}
```

### 10. Test Everything

- [ ] Editor loads without errors
- [ ] Can drag and drop components
- [ ] Can edit component properties
- [ ] Save/publish works
- [ ] Viewer renders correctly
- [ ] Data persists in database
- [ ] Can create new templates
- [ ] Can edit existing templates

## 🔧 Customizations

### Remove Demo Routes

If you don't want the demo routes:

```bash
rm -rf src/app/puck-demo
```

### Add Authentication

Wrap your routes with auth checks:

```typescript
// app/builder/[id]/edit/page.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function EditorPage({ params }) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // ... rest of component
}
```

### Add Custom Components

See main README.md section on "Adding Custom Components"

## 📞 Need Help?

Common issues:

1. **CSS not loading** - Make sure you imported `@measured/puck/puck.css`
2. **TypeScript errors** - Check that all Lexical packages are installed
3. **Components not showing** - Verify they're registered in `config.tsx`
4. **Data not saving** - Check your API routes and database schema

## ✨ You're Done!

Your Puck builder should now be fully integrated. Enjoy building visual page layouts!
