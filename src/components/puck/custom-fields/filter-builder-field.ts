/**
 * FilterBuilderField - Custom Puck field for building filter conditions
 *
 * AIDEV-NOTE: Uses Puck's "array" field type to allow users to build
 * complex filter queries with multiple conditions.
 *
 * Usage:
 * ```typescript
 * import { createFilterBuilderField } from './custom-fields/filter-builder-field';
 *
 * export const MyComponent: ComponentConfig = {
 *   fields: {
 *     filters: createFilterBuilderField({
 *       fields: metadata.table.fields
 *     })
 *   }
 * }
 * ```
 */

import { ArrayField } from "@measured/puck";
import type { TableField } from "@/ddd/domain/tables/value-objects/table-field";
import type { FilterOperator } from "@/ddd/domain/data-sources/value-objects/filter-config";

export interface FilterCondition {
  fieldId: number;
  fieldName: string;
  operator: FilterOperator;
  value?: string | number | boolean;
}

// Operator options grouped by category
const TEXT_OPERATORS: Array<{ label: string; value: FilterOperator }> = [
  { label: "Equals", value: "equals" },
  { label: "Not Equals", value: "not_equals" },
  { label: "Contains", value: "contains" },
  { label: "Not Contains", value: "not_contains" },
  { label: "Starts With", value: "starts_with" },
  { label: "Ends With", value: "ends_with" },
  { label: "Is Empty", value: "is_empty" },
  { label: "Is Not Empty", value: "is_not_empty" },
];

const NUMBER_OPERATORS: Array<{ label: string; value: FilterOperator }> = [
  { label: "Equals", value: "equals" },
  { label: "Not Equals", value: "not_equals" },
  { label: "Greater Than", value: "greater_than" },
  { label: "Greater Than or Equal", value: "greater_than_or_equal" },
  { label: "Less Than", value: "less_than" },
  { label: "Less Than or Equal", value: "less_than_or_equal" },
  { label: "Is Empty", value: "is_empty" },
  { label: "Is Not Empty", value: "is_not_empty" },
];

const BOOLEAN_OPERATORS: Array<{ label: string; value: FilterOperator }> = [
  { label: "Is True", value: "is_true" },
  { label: "Is False", value: "is_false" },
];

const ALL_OPERATORS: Array<{ label: string; value: FilterOperator }> = [
  ...TEXT_OPERATORS,
  ...NUMBER_OPERATORS,
  ...BOOLEAN_OPERATORS,
];

/**
 * Get appropriate operators for a field type
 */
function getOperatorsForFieldType(
  fieldType: string
): Array<{ label: string; value: FilterOperator }> {
  switch (fieldType) {
    case "text":
    case "email":
    case "url":
      return TEXT_OPERATORS;
    case "number":
      return NUMBER_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
    case "date":
      return NUMBER_OPERATORS; // Dates use comparison operators
    default:
      return ALL_OPERATORS;
  }
}

/**
 * Check if operator requires a value input
 */
function operatorRequiresValue(operator: FilterOperator): boolean {
  const noValueOperators: FilterOperator[] = [
    "is_empty",
    "is_not_empty",
    "is_true",
    "is_false",
  ];
  return !noValueOperators.includes(operator);
}

/**
 * Create a filter builder field
 *
 * This allows users to build complex filter queries with multiple conditions.
 */
export function createFilterBuilderField(params: {
  fields: TableField[];
}): any {
  return {
    type: "array",
    min: 0,
    getItemSummary: (item: any) => {
      const field = params.fields.find((f) => f.id.value === item.fieldId);
      const fieldName = field?.name || `Field ${item.fieldId}`;
      const value = operatorRequiresValue(item.operator)
        ? ` "${item.value}"`
        : "";
      return `${fieldName} ${item.operator}${value}`;
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
      operator: {
        type: "select",
        label: "Operator",
        options: ALL_OPERATORS,
      },
      value: {
        type: "text",
        label: "Value",
      },
    },

    defaultItemProps: {
      fieldId: params.fields[0]?.id.value || 0,
      fieldName: params.fields[0]?.name || "",
      operator: "equals",
      value: "",
    },
  };
}

/**
 * Simpler version with common operators only
 */
export function createSimpleFilterBuilderField(params: {
  fields: TableField[];
}): any {
  const SIMPLE_OPERATORS = [
    { label: "Equals", value: "equals" },
    { label: "Contains", value: "contains" },
    { label: "Greater Than", value: "greater_than" },
    { label: "Less Than", value: "less_than" },
  ];

  return {
    type: "array",
    min: 0,
    getItemSummary: (item: any) => {
      const field = params.fields.find((f) => f.id.value === item.fieldId);
      return `${field?.name || "Field"} ${item.operator} "${item.value}"`;
    },

    arrayFields: {
      fieldId: {
        type: "select",
        options: params.fields.map((field) => ({
          label: field.name,
          value: field.id.value,
        })),
      },
      operator: {
        type: "select",
        options: SIMPLE_OPERATORS,
      },
      value: {
        type: "text",
      },
    },

    defaultItemProps: {
      fieldId: params.fields[0]?.id.value || 0,
      operator: "equals",
      value: "",
    },
  };
}
