/**
 * BooleanField - Puck Component Configuration
 *
 * Field block for displaying boolean fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import BooleanField, { type BooleanFieldProps } from "./BooleanField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

export const BooleanFieldConfig: ComponentConfig<BooleanFieldProps> = {
  label: "Boolean Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["boolean"],
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
        { label: "Text", value: "text" },
        { label: "Badge", value: "badge" },
        { label: "Icon", value: "icon" },
      ],
    },

    trueText: {
      type: "text",
      label: "True Text",
    },

    falseText: {
      type: "text",
      label: "False Text",
    },

    iconStyle: {
      type: "select",
      label: "Icon Style",
      options: [
        { label: "Check/X", value: "check" },
        { label: "Circle Check/X", value: "circle" },
      ],
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
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "text",
    trueText: "Yes",
    falseText: "No",
    iconStyle: "check",
    size: "base",
  },

  resolveFields: (data, { fields }) => {
    const displayStyle = data.props.displayStyle;

    // Base fields
    const result: Record<string, any> = {
      fieldId: fields.fieldId,
      label: fields.label,
      labelPosition: fields.labelPosition,
      displayStyle: fields.displayStyle,
      size: fields.size,
    };

    // Show text options for text and badge styles
    if (displayStyle !== 'icon') {
      result.trueText = fields.trueText;
      result.falseText = fields.falseText;
    }

    // Show icon style only for icon display
    if (displayStyle === 'icon') {
      result.iconStyle = fields.iconStyle;
    }

    return result;
  },

  render: BooleanField,
};

export default BooleanFieldConfig;
export type { BooleanFieldProps };
