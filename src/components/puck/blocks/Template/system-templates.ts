/**
 * System Templates - Built-in templates using primitive components
 *
 * How it works:
 * - Blank templates: User drags components → Puck stores in `children` → Save reads `children`
 * - System templates: Select template → resolveData sets `children` (rendering) AND `_expandedChildren` (persisted) → Save reads `_expandedChildren`
 */

// Types
export type SystemTemplateVariant = {
  id: string;
  name: string;
  description?: string;
  data: any[];
  isDefault?: boolean;
};

export type SystemTemplate = {
  label: string;
  description?: string;
  variants: SystemTemplateVariant[];
};

// Helper functions
export function isSystemTemplate(value: string | undefined): boolean {
  return value?.startsWith("system_") ?? false;
}

export function isDbTemplate(value: string | undefined): boolean {
  return value?.startsWith("db_") ?? false;
}

export function getSystemTemplateKey(value: string): string | null {
  if (!isSystemTemplate(value)) return null;
  return value.replace("system_", "");
}

export function getSystemTemplate(value: string | undefined): SystemTemplate | null {
  if (!value || !isSystemTemplate(value)) return null;
  const key = value.replace("system_", "");
  return SYSTEM_TEMPLATES[key] ?? null;
}

export function getVariantData(
  template: SystemTemplate,
  variantId: string | undefined
): { variant: SystemTemplateVariant; data: any[] } | null {
  const variant = variantId
    ? template.variants.find((v) => v.id === variantId)
    : template.variants.find((v) => v.isDefault) || template.variants[0];

  if (!variant) return null;
  return { variant, data: variant.data };
}

export function getDefaultVariantId(
  template: SystemTemplate,
  currentVariantId: string | undefined
): string {
  if (currentVariantId) {
    const exists = template.variants.find((v) => v.id === currentVariantId);
    if (exists) return currentVariantId;
  }
  const defaultVariant = template.variants.find((v) => v.isDefault) || template.variants[0];
  return defaultVariant.id;
}

// System templates built with primitive components (Flex, Heading, Text, Button, Container)
// NOTE: Flex uses `items` slot, not `children`
export const SYSTEM_TEMPLATES: Record<string, SystemTemplate> = {
  hero: {
    label: "Hero",
    description: "Hero section with title and buttons",
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
  header: {
    label: "Header",
    description: "Navigation header",
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
  footer: {
    label: "Footer",
    description: "Page footer",
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
  logos: {
    label: "Logo Strip",
    description: "Partner or client logos",
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
  stats: {
    label: "Stats",
    description: "Key metrics display",
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
  card: {
    label: "Card",
    description: "Content card",
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
            paddingLevel: "6",
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
            paddingLevel: "6",
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
};
