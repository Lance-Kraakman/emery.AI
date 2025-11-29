/**
 * SelectField - Puck Component Configuration
 *
 * Field block for displaying select options as badges.
 * Category: "Fields"
 */

import type { ComponentConfig } from "@measured/puck";
import SelectField, { type SelectFieldProps } from "./SelectField";
import { createFieldSelectorField } from "../../custom-fields";
import {
  typographySizeField,
  labelPositionField,
} from "../../fields/standard-fields";

export const SelectFieldConfig: ComponentConfig<SelectFieldProps> = {
  label: "Select Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["single-select", "multi-select"],
    }),

    label: {
      type: "text",
      label: "Label (optional)",
    },

    labelPosition: labelPositionField,

    size: typographySizeField,

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    labelPosition: "top",
    size: "sm",
    fallback: "",
  },

  render: SelectField,
};

export default SelectFieldConfig;
export type { SelectFieldProps };
