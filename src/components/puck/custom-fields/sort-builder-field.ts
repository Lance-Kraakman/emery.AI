/**
 * SortBuilderField - Custom Puck field for configuring sorting
 *
 * AIDEV-NOTE: Uses Puck's "array" field type to allow users to configure
 * multi-field sorting with priority ordering.
 *
 * Usage:
 * ```typescript
 * import { createSortBuilderField } from './custom-fields/sort-builder-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     sorting: createSortBuilderField({
 *       fields: metadata.table.fields
 *     })
 *   }
 * }
 * ```
 */

import { ArrayField } from "@measured/puck";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import type { SortDirection } from "@/ddd/domain/views/value-objects/sort-config";

export interface SortRule {
  fieldId: number;
  fieldName: string;
  direction: SortDirection;
  priority: number;
}

/**
 * Create a sort builder field
 *
 * This allows users to configure multi-field sorting with priority ordering.
 */
export function createSortBuilderField(params: {
  fields: TableField[];
}): any {
  return {
    type: "array",
    min: 0,
    max: 5, // Limit to 5 sort rules for performance
    getItemSummary: (item: any) => {
      const field = params.fields.find((f) => f.id.value === item.fieldId);
      const fieldName = field?.name || `Field ${item.fieldId}`;
      const directionLabel = item.direction === "asc" ? "↑" : "↓";
      return `${item.priority + 1}. ${fieldName} ${directionLabel}`;
    },

    arrayFields: {
      fieldId: {
        type: "select",
        label: "Field",
        options: params.fields.map((field) => ({
          label: `${field.name} (${field.type})`,
          value: field.id.value,
        })),
      },
      fieldName: {
        type: "text",
        label: "Field Name",
        readOnly: true,
      },
      direction: {
        type: "radio",
        label: "Direction",
        options: [
          { label: "Ascending ↑", value: "asc" },
          { label: "Descending ↓", value: "desc" },
        ],
      },
      priority: {
        type: "number",
        label: "Priority (0 = highest)",
        min: 0,
        max: 10,
      },
    },

    defaultItemProps: {
      fieldId: params.fields[0]?.id.value || 0,
      fieldName: params.fields[0]?.name || "",
      direction: "asc",
      priority: 0,
    },
  };
}

/**
 * Simpler version with just field and direction (auto-priority)
 */
export function createSimpleSortBuilderField(params: {
  fields: TableField[];
}): any {
  return {
    type: "array",
    min: 0,
    max: 3, // Limit to 3 for simplicity
    getItemSummary: (item: any, index?: number) => {
      const field = params.fields.find((f) => f.id.value === item.fieldId);
      const directionLabel = item.direction === "asc" ? "↑" : "↓";
      return `${index! + 1}. ${field?.name || "Field"} ${directionLabel}`;
    },

    arrayFields: {
      fieldId: {
        type: "select",
        label: "Field",
        options: params.fields.map((field) => ({
          label: field.name,
          value: field.id.value,
        })),
      },
      direction: {
        type: "radio",
        label: "Direction",
        options: [
          { label: "A → Z", value: "asc" },
          { label: "Z → A", value: "desc" },
        ],
      },
    },

    defaultItemProps: {
      fieldId: params.fields[0]?.id.value || 0,
      direction: "asc",
    },
  };
}

/**
 * Single-field sort (simplest version)
 */
export function createSingleSortField(params: {
  fields: TableField[];
}): {
  fieldId: { type: "select"; options: Array<{ label: string; value: number }> };
  direction: { type: "radio"; options: Array<{ label: string; value: SortDirection }> };
} {
  return {
    fieldId: {
      type: "select",
      options: params.fields.map((field) => ({
        label: field.name,
        value: field.id.value,
      })),
    },
    direction: {
      type: "radio",
      options: [
        { label: "Ascending", value: "asc" },
        { label: "Descending", value: "desc" },
      ],
    },
  };
}
