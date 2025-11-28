/**
 * LinkField - Puck Component Configuration
 *
 * Field block for displaying URL fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import LinkField, { type LinkFieldProps } from "./LinkField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

export const LinkFieldConfig: ComponentConfig<LinkFieldProps> = {
  label: "Link Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["text"],
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
        { label: "Text Link", value: "text" },
        { label: "Button", value: "button" },
        { label: "Icon Only", value: "icon" },
      ],
    },

    linkText: {
      type: "text",
      label: "Link Text (optional, shows URL if empty)",
    },

    openInNewTab: {
      type: "radio",
      label: "Open in New Tab",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    showIcon: {
      type: "radio",
      label: "Show Icon",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
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

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "text",
    openInNewTab: true,
    showIcon: true,
    size: "base",
    fallback: "",
  },

  resolveFields: (data, { fields }) => {
    const displayStyle = data.props.displayStyle;

    // Base fields
    const result: Record<string, any> = {
      fieldId: fields.fieldId,
      label: fields.label,
      labelPosition: fields.labelPosition,
      displayStyle: fields.displayStyle,
      openInNewTab: fields.openInNewTab,
      size: fields.size,
      fallback: fields.fallback,
    };

    // Show link text for text and button styles
    if (displayStyle !== 'icon') {
      result.linkText = fields.linkText;
      result.showIcon = fields.showIcon;
    }

    return result;
  },

  render: LinkField,
};

export default LinkFieldConfig;
export type { LinkFieldProps };
