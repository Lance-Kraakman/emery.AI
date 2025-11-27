/**
 * FieldMappingField - Custom Puck field for mapping table fields to display columns
 *
 * AIDEV-NOTE: Uses Puck's "array" field type to allow users to configure
 * how table fields map to display columns in the UI.
 *
 * Usage:
 * ```typescript
 * import { createFieldMappingField } from './custom-fields/field-mapping-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     fieldMappings: createFieldMappingField({
 *       fields: metadata.table.fields // From resolveTableMetadata
 *     })
 *   }
 * }
 * ```
 */

import { ArrayField } from "@measured/puck";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";

export interface FieldMapping {
  sourceFieldId: number;
  sourceFieldName: string;
  displayName: string;
  visible: boolean;
  order: number;
}

/**
 * Create a field mapping array field
 *
 * This allows users to map source table fields to display columns,
 * rename them, reorder them, and show/hide them.
 */
export function createFieldMappingField(params: {
  fields: TableField[];
  defaultMappings?: FieldMapping[];
}): any {
  // Create default mappings if not provided
  const defaultMappings =
    params.defaultMappings ||
    params.fields.map((field, index) => ({
      sourceFieldId: field.id.value,
      sourceFieldName: field.name,
      displayName: field.name,
      visible: true,
      order: index,
    }));

  return {
    type: "array",
    min: 0,
    getItemSummary: (item: any) =>
      item.visible
        ? `${item.displayName} (${item.sourceFieldName})`
        : `[Hidden] ${item.displayName}`,
    defaultValue: defaultMappings,

    arrayFields: {
      sourceFieldId: {
        type: "select",
        options: params.fields.map((field) => ({
          label: `${field.name} (${field.type})`,
          value: field.id.value,
        })),
      },
      sourceFieldName: {
        type: "text",
        label: "Source Field",
        readOnly: true,
      },
      displayName: {
        type: "text",
        label: "Display Name",
      },
      visible: {
        type: "radio",
        options: [
          { label: "Show", value: true },
          { label: "Hide", value: false },
        ],
      },
      order: {
        type: "number",
        min: 0,
        label: "Order",
      },
    },
  };
}

/**
 * Simpler version with just show/hide and rename
 */
export function createSimpleFieldMappingField(params: {
  fields: TableField[];
}): any {
  return {
    type: "array",
    min: 0,
    getItemSummary: (item: any) =>
      item.visible ? item.displayName : `[Hidden] ${item.displayName}`,
    defaultValue: params.fields.map((field) => ({
      fieldId: field.id.value,
      displayName: field.name,
      visible: true,
    })),

    arrayFields: {
      fieldId: {
        type: "select",
        options: params.fields.map((field) => ({
          label: `${field.name} (${field.type})`,
          value: field.id.value,
        })),
      },
      displayName: {
        type: "text",
      },
      visible: {
        type: "radio",
        options: [
          { label: "Show", value: true },
          { label: "Hide", value: false },
        ],
      },
    },
  };
}
