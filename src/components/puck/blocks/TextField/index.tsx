/**
 * TextField - Puck Component Configuration
 *
 * Field block for displaying text/email fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import TextField, { type TextFieldProps } from "./TextField";
import { createFieldSelectorField } from "../../custom-fields";
import {
  typographySizeField,
  textColorField,
  fontFamilyField,
  fontWeightField,
  labelPositionField,
} from "../../fields/standard-fields";

export const TextFieldConfig: ComponentConfig<TextFieldProps> = {
  label: "Text Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["text", "email", "phone"],
    }),

    label: {
      type: "text",
      label: "Label (optional)",
    },

    labelPosition: labelPositionField,

    size: typographySizeField,

    textColor: textColorField,

    fontFamily: fontFamilyField,

    fontWeight: fontWeightField,

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
    labelPosition: "top",
    size: "base",
    fallback: "",
  },

  render: TextField,
};

export default TextFieldConfig;
export type { TextFieldProps };
