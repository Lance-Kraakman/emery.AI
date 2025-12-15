#!/usr/bin/env npx tsx

// AIDEV-NOTE: Seeds system templates into the database
// These are global templates available to all users (isSystem = true, organizationId = null)

import { db } from '../../lib/db/client';
import { templates } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

// Template data - same structure as the old SYSTEM_TEMPLATES
const SYSTEM_TEMPLATES = [
  {
    name: "Hero",
    description: "Hero section with title and buttons",
    category: "layout",
    data: [{
      type: "Flex",
      props: {
        direction: "column",
        justifyContent: "start",
        gap: "4",
        wrap: "nowrap",
        items: [
          { type: "Heading", props: { text: "Welcome to Your Site", size: "4xl", align: "left" } },
          { type: "Text", props: { text: "A powerful platform for building amazing experiences. Get started today and see what you can create.", size: "lg", align: "left" } },
          { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
            { type: "Button", props: { label: "Get Started", variant: "primary", actions: [] } },
            { type: "Button", props: { label: "Learn More", variant: "secondary", actions: [] } },
          ]}},
        ],
      },
    }],
    variants: [
      {
        id: "default",
        name: "Left-aligned",
        description: "Content aligned left",
        isDefault: true,
        data: [{
          type: "Flex",
          props: {
            direction: "column",
            justifyContent: "start",
            gap: "4",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "Welcome to Your Site", size: "4xl", align: "left" } },
              { type: "Text", props: { text: "A powerful platform for building amazing experiences. Get started today and see what you can create.", size: "lg", align: "left" } },
              { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                { type: "Button", props: { label: "Get Started", variant: "primary", actions: [] } },
                { type: "Button", props: { label: "Learn More", variant: "secondary", actions: [] } },
              ]}},
            ],
          },
        }],
      },
      {
        id: "centered",
        name: "Centered",
        description: "Content centered",
        data: [{
          type: "Flex",
          props: {
            direction: "column",
            justifyContent: "center",
            gap: "4",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "Welcome to Your Site", size: "4xl", align: "center" } },
              { type: "Text", props: { text: "A powerful platform for building amazing experiences. Get started today and see what you can create.", size: "lg", align: "center" } },
              { type: "Flex", props: { direction: "row", justifyContent: "center", gap: "2", wrap: "nowrap", items: [
                { type: "Button", props: { label: "Get Started", variant: "primary", actions: [] } },
                { type: "Button", props: { label: "Learn More", variant: "secondary", actions: [] } },
              ]}},
            ],
          },
        }],
      },
    ],
  },
  {
    name: "Header",
    description: "Navigation header",
    category: "navigation",
    data: [{
      type: "Flex",
      props: {
        direction: "row",
        justifyContent: "start",
        gap: "4",
        wrap: "nowrap",
        items: [
          { type: "Heading", props: { text: "LOGO", size: "xl", align: "left" } },
          { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "2", wrap: "nowrap", layout: { grow: true }, items: [
            { type: "Button", props: { label: "Home", variant: "secondary", actions: [] } },
            { type: "Button", props: { label: "About", variant: "secondary", actions: [] } },
            { type: "Button", props: { label: "Contact", variant: "secondary", actions: [] } },
          ]}},
          { type: "Button", props: { label: "Get Started", variant: "primary", actions: [] } },
        ],
      },
    }],
    variants: [
      {
        id: "left-nav",
        name: "Left Nav",
        description: "Logo left, nav right",
        isDefault: true,
        data: [{
          type: "Flex",
          props: {
            direction: "row",
            justifyContent: "start",
            gap: "4",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "LOGO", size: "xl", align: "left" } },
              { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "2", wrap: "nowrap", layout: { grow: true }, items: [
                { type: "Button", props: { label: "Home", variant: "secondary", actions: [] } },
                { type: "Button", props: { label: "About", variant: "secondary", actions: [] } },
                { type: "Button", props: { label: "Contact", variant: "secondary", actions: [] } },
              ]}},
              { type: "Button", props: { label: "Get Started", variant: "primary", actions: [] } },
            ],
          },
        }],
      },
      {
        id: "centered",
        name: "Centered",
        description: "Logo and nav centered",
        data: [{
          type: "Flex",
          props: {
            direction: "column",
            justifyContent: "center",
            gap: "2",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "LOGO", size: "xl", align: "center" } },
              { type: "Flex", props: { direction: "row", justifyContent: "center", gap: "2", wrap: "nowrap", items: [
                { type: "Button", props: { label: "Home", variant: "secondary", actions: [] } },
                { type: "Button", props: { label: "About", variant: "secondary", actions: [] } },
                { type: "Button", props: { label: "Contact", variant: "secondary", actions: [] } },
              ]}},
            ],
          },
        }],
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Logo and CTA only",
        data: [{
          type: "Flex",
          props: {
            direction: "row",
            justifyContent: "start",
            gap: "4",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "LOGO", size: "xl", align: "left", layout: { grow: true } } },
              { type: "Button", props: { label: "Contact", variant: "primary", actions: [] } },
            ],
          },
        }],
      },
    ],
  },
  {
    name: "Footer",
    description: "Page footer",
    category: "navigation",
    data: [{
      type: "Flex",
      props: {
        direction: "column",
        justifyContent: "start",
        gap: "6",
        wrap: "nowrap",
        items: [
          { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "8", wrap: "wrap", items: [
            { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
              { type: "Heading", props: { text: "Product", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Features", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Pricing", size: "sm", align: "left" } },
              { type: "Text", props: { text: "FAQ", size: "sm", align: "left" } },
            ]}},
            { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
              { type: "Heading", props: { text: "Company", size: "sm", align: "left" } },
              { type: "Text", props: { text: "About", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Blog", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Careers", size: "sm", align: "left" } },
            ]}},
            { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
              { type: "Heading", props: { text: "Support", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Help Center", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Contact", size: "sm", align: "left" } },
              { type: "Text", props: { text: "Status", size: "sm", align: "left" } },
            ]}},
          ]}},
          { type: "Text", props: { text: "© 2025 Your Company. All rights reserved.", size: "sm", align: "left" } },
        ],
      },
    }],
    variants: [
      {
        id: "columns",
        name: "Columns",
        description: "Multi-column links",
        isDefault: true,
        data: [{
          type: "Flex",
          props: {
            direction: "column",
            justifyContent: "start",
            gap: "6",
            wrap: "nowrap",
            items: [
              { type: "Flex", props: { direction: "row", justifyContent: "start", gap: "8", wrap: "wrap", items: [
                { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                  { type: "Heading", props: { text: "Product", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Features", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Pricing", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "FAQ", size: "sm", align: "left" } },
                ]}},
                { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                  { type: "Heading", props: { text: "Company", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "About", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Blog", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Careers", size: "sm", align: "left" } },
                ]}},
                { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                  { type: "Heading", props: { text: "Support", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Help Center", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Contact", size: "sm", align: "left" } },
                  { type: "Text", props: { text: "Status", size: "sm", align: "left" } },
                ]}},
              ]}},
              { type: "Text", props: { text: "© 2025 Your Company. All rights reserved.", size: "sm", align: "left" } },
            ],
          },
        }],
      },
      {
        id: "centered",
        name: "Centered",
        description: "Centered content",
        data: [{
          type: "Flex",
          props: {
            direction: "column",
            justifyContent: "center",
            gap: "4",
            wrap: "nowrap",
            items: [
              { type: "Heading", props: { text: "Your Company", size: "xl", align: "center" } },
              { type: "Text", props: { text: "Building amazing experiences together.", size: "base", align: "center" } },
              { type: "Text", props: { text: "© 2025 Your Company. All rights reserved.", size: "sm", align: "center" } },
            ],
          },
        }],
      },
      {
        id: "minimal",
        name: "Minimal",
        description: "Simple copyright",
        data: [{
          type: "Text",
          props: { text: "© 2025 Your Company. All rights reserved.", size: "sm", align: "center" },
        }],
      },
    ],
  },
  {
    name: "Logo Strip",
    description: "Partner or client logos",
    category: "content",
    data: [{
      type: "Flex",
      props: {
        direction: "row",
        justifyContent: "center",
        gap: "6",
        wrap: "wrap",
        items: [
          { type: "Text", props: { text: "Logo 1", size: "lg", align: "center" } },
          { type: "Text", props: { text: "Logo 2", size: "lg", align: "center" } },
          { type: "Text", props: { text: "Logo 3", size: "lg", align: "center" } },
          { type: "Text", props: { text: "Logo 4", size: "lg", align: "center" } },
          { type: "Text", props: { text: "Logo 5", size: "lg", align: "center" } },
        ],
      },
    }],
    variants: [
      {
        id: "default",
        name: "Default",
        isDefault: true,
        data: [{
          type: "Flex",
          props: {
            direction: "row",
            justifyContent: "center",
            gap: "6",
            wrap: "wrap",
            items: [
              { type: "Text", props: { text: "Logo 1", size: "lg", align: "center" } },
              { type: "Text", props: { text: "Logo 2", size: "lg", align: "center" } },
              { type: "Text", props: { text: "Logo 3", size: "lg", align: "center" } },
              { type: "Text", props: { text: "Logo 4", size: "lg", align: "center" } },
              { type: "Text", props: { text: "Logo 5", size: "lg", align: "center" } },
            ],
          },
        }],
      },
    ],
  },
  {
    name: "Stats",
    description: "Key metrics display",
    category: "content",
    data: [{
      type: "Flex",
      props: {
        direction: "row",
        justifyContent: "center",
        gap: "8",
        wrap: "wrap",
        items: [
          { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
            { type: "Heading", props: { text: "10,000+", size: "3xl", align: "center" } },
            { type: "Text", props: { text: "Users", size: "sm", align: "center" } },
          ]}},
          { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
            { type: "Heading", props: { text: "$1M+", size: "3xl", align: "center" } },
            { type: "Text", props: { text: "Revenue", size: "sm", align: "center" } },
          ]}},
          { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
            { type: "Heading", props: { text: "50+", size: "3xl", align: "center" } },
            { type: "Text", props: { text: "Countries", size: "sm", align: "center" } },
          ]}},
          { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
            { type: "Heading", props: { text: "99.9%", size: "3xl", align: "center" } },
            { type: "Text", props: { text: "Uptime", size: "sm", align: "center" } },
          ]}},
        ],
      },
    }],
    variants: [
      {
        id: "default",
        name: "Default",
        isDefault: true,
        data: [{
          type: "Flex",
          props: {
            direction: "row",
            justifyContent: "center",
            gap: "8",
            wrap: "wrap",
            items: [
              { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "10,000+", size: "3xl", align: "center" } },
                { type: "Text", props: { text: "Users", size: "sm", align: "center" } },
              ]}},
              { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "$1M+", size: "3xl", align: "center" } },
                { type: "Text", props: { text: "Revenue", size: "sm", align: "center" } },
              ]}},
              { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "50+", size: "3xl", align: "center" } },
                { type: "Text", props: { text: "Countries", size: "sm", align: "center" } },
              ]}},
              { type: "Flex", props: { direction: "column", justifyContent: "center", gap: "1", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "99.9%", size: "3xl", align: "center" } },
                { type: "Text", props: { text: "Uptime", size: "sm", align: "center" } },
              ]}},
            ],
          },
        }],
      },
    ],
  },
  {
    name: "Card",
    description: "Content card",
    category: "content",
    data: [{
      type: "Container",
      props: {
        variant: "card",
        shadow: "md",
        padding: { top: 6, right: 6, bottom: 6, left: 6, linked: true },
        children: [
          { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
            { type: "Heading", props: { text: "Card Title", size: "xl", align: "left" } },
            { type: "Text", props: { text: "This is a description for the card. Add your own content here.", size: "base", align: "left" } },
          ]}},
        ],
      },
    }],
    variants: [
      {
        id: "default",
        name: "Default",
        description: "Basic card layout",
        isDefault: true,
        data: [{
          type: "Container",
          props: {
            variant: "card",
            shadow: "md",
            padding: { top: 6, right: 6, bottom: 6, left: 6, linked: true },
            children: [
              { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "Card Title", size: "xl", align: "left" } },
                { type: "Text", props: { text: "This is a description for the card. Add your own content here.", size: "base", align: "left" } },
              ]}},
            ],
          },
        }],
      },
      {
        id: "bordered",
        name: "Bordered",
        description: "With border, no shadow",
        data: [{
          type: "Container",
          props: {
            variant: "bordered",
            shadow: "none",
            padding: { top: 6, right: 6, bottom: 6, left: 6, linked: true },
            children: [
              { type: "Flex", props: { direction: "column", justifyContent: "start", gap: "2", wrap: "nowrap", items: [
                { type: "Heading", props: { text: "Card Title", size: "xl", align: "left" } },
                { type: "Text", props: { text: "This is a description for the card. Add your own content here.", size: "base", align: "left" } },
              ]}},
            ],
          },
        }],
      },
    ],
  },
];

async function seedSystemTemplates() {
  console.log('🌱 Seeding system templates...');

  let created = 0;
  let skipped = 0;

  for (const template of SYSTEM_TEMPLATES) {
    try {
      // Check if template already exists by name and isSystem
      const existing = await db.query.templates.findFirst({
        where: eq(templates.isSystem, true),
      });

      // Check by name specifically
      const existingByName = await db
        .select()
        .from(templates)
        .where(eq(templates.name, template.name))
        .limit(1);

      if (existingByName.length > 0 && existingByName[0].isSystem) {
        console.log(`  ⏭️  Skipping "${template.name}" (already exists)`);
        skipped++;
        continue;
      }

      await db.insert(templates).values({
        organizationId: null, // Global system template
        appId: null,
        name: template.name,
        description: template.description,
        category: template.category,
        isSystem: true,
        data: template.data as any,
        variants: template.variants as any,
        createdBy: null, // System templates have no creator
      });

      console.log(`  ✅ Created "${template.name}"`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to create "${template.name}":`, error);
    }
  }

  console.log(`\n✅ Seeding complete: ${created} created, ${skipped} skipped`);
}

// Run if called directly
seedSystemTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
