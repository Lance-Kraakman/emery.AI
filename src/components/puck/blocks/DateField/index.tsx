/**
 * DateField - Puck Component Configuration
 *
 * Field block for displaying formatted dates.
 * Category: "Fields"
 */

import type { ComponentConfig } from "@measured/puck";
import DateField, { type DateFieldProps } from "./DateField";

export const DateFieldConfig: ComponentConfig<DateFieldProps> = {
  label: "Date Field",

  fields: {
    fieldId: {
      type: "number",
      label: "Field ID",
    },

    label: {
      type: "text",
      label: "Label (optional)",
    },

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

    fallback: {
      type: "text",
      label: "Fallback Text",
    },
  },

  defaultProps: {
    fieldId: 0,
    format: "short",
    fallback: "",
  },

  render: DateField,
};

export default DateFieldConfig;
export type { DateFieldProps };
