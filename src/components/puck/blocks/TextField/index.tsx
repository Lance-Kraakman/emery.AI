/**
 * TextField - Puck Component Configuration
 *
 * Field block for displaying text/email fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import TextField, { type TextFieldProps } from "./TextField";

export const TextFieldConfig: ComponentConfig<TextFieldProps> = {
  label: "Text Field",

  fields: {
    fieldId: {
      type: "number",
      label: "Field ID",
      // TODO: Replace with custom field selector that shows field names
    },

    label: {
      type: "text",
      label: "Label (optional)",
    },

    style: {
      type: "select",
      label: "Style",
      options: [
        { label: "Default", value: "default" },
        { label: "Bold", value: "bold" },
        { label: "Muted", value: "muted" },
        { label: "Heading", value: "heading" },
      ],
    },

    maxLength: {
      type: "number",
      label: "Max Length (optional, truncates with ...)",
    },

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    fieldId: 0,
    style: "default",
    fallback: "",
  },

  render: TextField,
};

export default TextFieldConfig;
export type { TextFieldProps };
