/**
 * FileField - Puck Component Configuration
 *
 * Field block for displaying file fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import FileField, { type FileFieldProps } from "./FileField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

export const FileFieldConfig: ComponentConfig<FileFieldProps> = {
  label: "File Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["file"],
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
        { label: "List", value: "list" },
        { label: "Compact", value: "compact" },
        { label: "Cards", value: "card" },
      ],
    },

    maxItems: {
      type: "number",
      label: "Max Files to Show",
      min: 1,
      max: 20,
    },

    showSize: {
      type: "radio",
      label: "Show File Size",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    showDownload: {
      type: "radio",
      label: "Show Download Button",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "list",
    maxItems: 5,
    showSize: true,
    showDownload: true,
  },

  render: FileField,
};

export default FileFieldConfig;
export type { FileFieldProps };
