# Puck App Builder - Portable Package

This package contains a clean, portable extraction of the Puck visual page builder from the Dashlet project. It includes all core layout and content components, plus a working demo using localStorage.

## 📦 What's Included

### Core Components

**Layout Components:**
- **Columns** - Grid-based column layout with auto/manual distribution (1-12 span)
- **Flex** - Flexible box layout with configurable direction, alignment, gap
- **Grid** - CSS Grid layout with configurable rows/columns
- **VerticalSpace** - Spacing component with preset sizes (8px - 160px)

**Content Components:**
- **Heading** - Configurable heading levels (title, h1-h6) with alignment, weight, color
- **Text** - Text component with size options (s, m, l, xl, xxl)
- **Markdown** - Markdown content rendering with size/alignment options
- **Image** - Image display with URL and maxWidth configuration
- **RichText** - Full Lexical-based rich text editor with toolbar
- **Table** - Placeholder table component (implement your own)

### Structure

```
puck-extraction/
├── README.md                      # This file
├── components/
│   ├── config.tsx                # Main Puck configuration
│   ├── blocks/                   # All component blocks
│   │   ├── Columns/
│   │   ├── Flex/
│   │   ├── Grid/
│   │   ├── VerticalSpace/
│   │   ├── Heading/
│   │   ├── Text/
│   │   ├── Markdown/
│   │   ├── Image/
│   │   ├── RichText/            # Full Lexical editor
│   │   ├── Table/
│   │   └── index.ts             # Exports all blocks
│   └── shared/
│       └── Section/             # Shared Section component
├── types/                        # TypeScript types
└── python-puck-gen/             # Python template generation (optional)
    ├── README.md
    └── puck_gen/                # Python module
```

## 🚀 Quick Start - Try the Demo

A working demo is available in this repository at `/puck-demo`:

1. Navigate to `http://localhost:3000/puck-demo/editor` (after running `pnpm dev`)
2. Build your template using drag-and-drop
3. Click "Publish" to save to localStorage
4. View your template at `/puck-demo/viewer`
5. Create multiple templates and switch between them

The demo uses localStorage for persistence - no database required!

## 📋 Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "@measured/puck": "^0.18.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.0",
    "lexical": "^0.20.0",
    "@lexical/react": "^0.20.0",
    "@lexical/list": "^0.20.0",
    "@lexical/rich-text": "^0.20.0",
    "@lexical/link": "^0.20.0"
  }
}
```

## 🔧 Integration Steps

### 1. Copy Files to Your New Repo

```bash
# From this repo's root
cp -r puck-extraction <your-new-repo>/src/
```

### 2. Import in Your Application

```typescript
import { Puck, Render, Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";
```

### 3. Editor Route (with your persistence)

```typescript
// app/editor/page.tsx
"use client";

import { Puck, Data } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";

export default function EditorPage() {
  const [data, setData] = useState<Data>({
    content: [],
    root: {},
    zones: {},
  });

  const handleSave = async (data: Data) => {
    // Save to your database using Drizzle
    await db.insert(templates).values({
      name: "My Template",
      data: JSON.stringify(data),
    });
  };

  return (
    <div style={{ height: "100vh" }}>
      <Puck
        config={config}
        data={data}
        onPublish={handleSave}
      />
    </div>
  );
}
```

### 4. Viewer Route

```typescript
// app/viewer/[id]/page.tsx
import { Render } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/puck-extraction/components/config";

export default async function ViewerPage({ params }: { params: { id: string } }) {
  // Load from your database
  const template = await db.query.templates.findFirst({
    where: eq(templates.id, params.id),
  });

  const data = JSON.parse(template.data);

  return (
    <div>
      <Render config={config} data={data} />
    </div>
  );
}
```

## 💾 Persistence Layer

### Drizzle Schema Example

```typescript
import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const templates = pgTable("puck_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(), // Puck Data object
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pages = pgTable("puck_pages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  templates: jsonb("templates"), // Array of { templateId, order }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### API Routes Example

```typescript
// app/api/templates/route.ts
import { db } from "@/db";
import { templates } from "@/db/schema";

export async function POST(req: Request) {
  const body = await req.json();

  const template = await db.insert(templates).values({
    id: crypto.randomUUID(),
    name: body.name,
    data: body.data,
  }).returning();

  return Response.json(template[0]);
}

export async function GET() {
  const allTemplates = await db.select().from(templates);
  return Response.json(allTemplates);
}
```

## 🎨 Customization

### Adding Custom Components

1. Create a new component in `components/blocks/YourComponent/`:

```typescript
// components/blocks/YourComponent/index.tsx
import { ComponentConfig } from "@measured/puck";

export type YourComponentProps = {
  title: string;
  description: string;
};

export const YourComponent: ComponentConfig<YourComponentProps> = {
  fields: {
    title: { type: "text" },
    description: { type: "textarea" },
  },
  defaultProps: {
    title: "Default Title",
    description: "Default Description",
  },
  render: ({ title, description }) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
};
```

2. Add to `config.tsx`:

```typescript
import { YourComponent } from "./blocks/YourComponent";

export const config = {
  components: {
    // ... existing components
    YourComponent,
  },
  categories: {
    content: {
      title: "Content",
      components: ["Heading", "Text", "YourComponent"], // Add here
    },
  },
};
```

### Styling

Components use CSS modules. To customize:

1. Edit the `.module.css` files in each component directory
2. Override Puck's default styles by adding to your global CSS:

```css
/* Override Puck editor colors */
:root {
  --puck-color-grey-01: #f9fafb;
  --puck-color-grey-05: #6b7280;
  --puck-color-azure-04: #3b82f6;
}
```

## 🔌 Data-Connected Components

The original implementation had workflow-connected components. To recreate this pattern:

### 1. Create a Custom Field Type

```typescript
// components/fields/DataSourceField.tsx
import { CustomField } from "@measured/puck";

export const DataSourceField: CustomField = {
  type: "custom",
  render: ({ name, value, onChange }) => (
    <select
      value={value?.sourceId || ""}
      onChange={(e) => onChange({ sourceId: e.target.value })}
    >
      <option value="">Select Data Source</option>
      {/* Load your data sources from API */}
    </select>
  ),
};
```

### 2. Register in Config

```typescript
export const config = {
  // ... components
  fields: {
    dataSource: DataSourceField,
  },
};
```

### 3. Use in Components

```typescript
export const ChartComponent: ComponentConfig = {
  fields: {
    dataSource: { type: "dataSource" }, // Your custom field
  },
  render: ({ dataSource }) => {
    // Fetch data based on dataSource
    const data = useQuery(['chart-data', dataSource.sourceId]);
    return <Chart data={data} />;
  },
};
```

## 🐍 Python Template Generation (Optional)

The `python-puck-gen/` directory contains Python code for programmatically generating Puck templates. See `python-puck-gen/README.md` for details.

**Use case:** Automatically generate report templates from analysis results, data processing outputs, etc.

## 📝 Data Format

Puck stores templates as JSON in this format:

```typescript
type Data = {
  content: Array<{
    type: string;  // Component type
    props: {
      id: string;  // Unique component ID
      [key: string]: any;  // Component-specific props
    };
  }>;
  root: Record<string, any>;
  zones: Record<string, Array<{ type: string; props: any }>>;
};
```

Example:

```json
{
  "content": [
    {
      "type": "Heading",
      "props": {
        "id": "heading-1",
        "text": "My Heading",
        "type": "h1",
        "align": "center"
      }
    },
    {
      "type": "Columns",
      "props": {
        "id": "columns-1",
        "distribution": "auto",
        "columns": [{}, {}]
      }
    }
  ],
  "root": {},
  "zones": {
    "column-0": [
      {
        "type": "Text",
        "props": {
          "id": "text-1",
          "text": "Column 1 content"
        }
      }
    ]
  }
}
```

## 🔍 Key Features

### Visual Editor
- Drag-and-drop component placement
- Real-time preview
- Property editing sidebar
- Component categories
- Undo/redo support (built into Puck)

### Nested Layouts
- Drop zones in Columns, Flex, Grid
- Unlimited nesting depth
- Responsive design support

### Rich Content
- Lexical-based rich text editor
- Markdown rendering with size/style options
- Image support
- Customizable headings and text

## 🚨 What's NOT Included

These were removed as they're project-specific:

- **Workflow-connected components** (WorkflowChart, NivoChartV2, WorkflowMarkdown, DebateTable, Comments)
- **PayloadCMS integration** - You need to wire up your own persistence
- **Authentication** - Add your own auth layer
- **Export functionality** - The original had PDF/image export (not included)
- **Header/Footer components** - Were project-specific

## 📚 Resources

- [Puck Documentation](https://puckeditor.com/docs)
- [Measured Puck GitHub](https://github.com/measuredco/puck)
- [Lexical Documentation](https://lexical.dev/)

## 🐛 Troubleshooting

### Components not rendering?

Check that you've imported the CSS:
```typescript
import "@measured/puck/puck.css";
```

### TypeScript errors?

Ensure your types match the component props:
```typescript
import type { Config } from "@measured/puck";
```

### RichText not working?

Make sure all Lexical dependencies are installed:
```bash
pnpm add lexical @lexical/react @lexical/list @lexical/rich-text @lexical/link
```

## 📄 License

Extracted from Dashlet (proprietary). Use in your own projects as needed.

## 🎯 Next Steps

1. ✅ Copy files to your new repo
2. ✅ Install dependencies
3. ✅ Test the demo routes
4. ✅ Set up your database schema (Drizzle)
5. ✅ Create editor and viewer routes
6. ✅ Wire up persistence
7. ✅ Add custom components as needed
8. ✅ Style to match your design system

Good luck with your integration! 🚀
