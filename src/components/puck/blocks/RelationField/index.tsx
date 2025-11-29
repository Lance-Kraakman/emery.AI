/**
 * RelationField - Puck Component Configuration
 *
 * Field block for displaying relation fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import RelationField, { type RelationFieldProps } from "./RelationField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

export const RelationFieldConfig: ComponentConfig<RelationFieldProps> = {
  label: "Relation Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["relation"],
    }),

    label: {
      type: "text",
      label: "Label (optional)",
    },

    labelPosition: labelPositionField,

    displayStyle: {
      type: "select",
      label: "Display Style",
      options: [
        { label: "Badges", value: "badge" },
        { label: "List", value: "list" },
        { label: "Comma Separated", value: "comma" },
      ],
    },

    maxItems: {
      type: "number",
      label: "Max Items to Show",
      min: 1,
      max: 20,
    },

    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "base" },
        { label: "Large", value: "lg" },
      ],
    },

    showIcon: {
      type: "radio",
      label: "Show Link Icon",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "badge",
    maxItems: 5,
    size: "base",
    showIcon: true,
  },

  render: RelationField,
};

export default RelationFieldConfig;
export type { RelationFieldProps };
