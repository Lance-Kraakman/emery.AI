/**
 * SelectField - Puck Component Configuration
 *
 * Field block for displaying select options as badges.
 * Category: "Fields"
 */

import type { ComponentConfig } from "@measured/puck";
import SelectField, { type SelectFieldProps } from "./SelectField";

export const SelectFieldConfig: ComponentConfig<SelectFieldProps> = {
  label: "Select Field",

  fields: {
    fieldId: {
      type: "number",
      label: "Field ID",
    },

    label: {
      type: "text",
      label: "Label (optional)",
    },

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    fieldId: 0,
    fallback: "",
  },

  render: SelectField,
};

export default SelectFieldConfig;
export type { SelectFieldProps };
