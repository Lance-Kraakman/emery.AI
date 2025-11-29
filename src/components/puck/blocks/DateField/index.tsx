/**
 * DateField - Puck Component Configuration
 *
 * Field block for displaying formatted dates.
 * Category: "Fields"
 */

import type { ComponentConfig } from "@measured/puck";
import DateField, { type DateFieldProps } from "./DateField";
import { createFieldSelectorField } from "../../custom-fields";
import {
  typographySizeField,
  textColorField,
  fontFamilyField,
  fontWeightField,
  labelPositionField,
} from "../../fields/standard-fields";

export const DateFieldConfig: ComponentConfig<DateFieldProps> = {
  label: "Date Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["date", "last-updated", "created-at"],
    }),

    label: {
      type: "text",
      label: "Label (optional)",
    },

    labelPosition: labelPositionField,

    format: {
      type: "select",
      label: "Format",
      options: [
        { label: "Short (MM/DD/YYYY)", value: "short" },
        { label: "Long (Month Day, Year)", value: "long" },
        { label: "With Time", value: "time" },
        { label: "Relative (2 days ago)", value: "relative" },
      ],
    },

    size: typographySizeField,

    textColor: textColorField,

    fontFamily: fontFamilyField,

    fontWeight: fontWeightField,

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    labelPosition: "top",
    format: "short",
    size: "base",
    fallback: "",
  },

  render: DateField,
};

export default DateFieldConfig;
export type { DateFieldProps };
