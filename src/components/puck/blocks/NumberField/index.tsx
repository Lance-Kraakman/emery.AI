/**
 * NumberField - Puck Component Configuration
 *
 * Field block for displaying number fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import NumberField, { type NumberFieldProps } from "./NumberField";
import { createFieldSelectorField } from "../../custom-fields";
import {
  typographySizeField,
  textColorField,
  fontFamilyField,
  fontWeightField,
  labelPositionField,
} from "../../fields/standard-fields";

export const NumberFieldConfig: ComponentConfig<NumberFieldProps> = {
  label: "Number Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["number"],
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

    decimalPlaces: {
      type: "number",
      label: "Decimal Places",
      min: 0,
      max: 10,
    },

    prefix: {
      type: "text",
      label: "Prefix (e.g., $)",
    },

    suffix: {
      type: "text",
      label: "Suffix (e.g., %)",
    },

    useGrouping: {
      type: "radio",
      label: "Use Thousand Separators",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    labelPosition: "top",
    size: "base",
    prefix: "",
    suffix: "",
    useGrouping: true,
    fallback: "",
  },

  render: NumberField,
};

export default NumberFieldConfig;
export type { NumberFieldProps };
