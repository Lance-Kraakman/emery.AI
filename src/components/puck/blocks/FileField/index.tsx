/**
 * FileField - Puck Component Configuration
 *
 * Field block for displaying file fields from data context.
 * Category: "Fields" - Data display blocks that require context
 * Supports view-only and edit modes with configurable edit actions.
 */

import type { ComponentConfig } from "@measured/puck";
import FileField from "./FileField";
import FileEditMode from "./FileEditMode";
import { createFieldSelectorField, createActionsField } from "../../custom-fields";
import {
  labelPositionField,
  textColorField,
  fontFamilyField,
} from "../../fields/standard-fields";
import type { FileFieldProps } from "./types";

/**
 * Router component that renders the appropriate mode
 */
function FileFieldRouter(props: FileFieldProps) {
  if (props.mode === 'edit') {
    return <FileEditMode {...props} />;
  }
  return <FileField {...props} />;
}

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

    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Compact", value: "compact" },
        { label: "Normal", value: "normal" },
        { label: "Large", value: "large" },
      ],
    },

    mode: {
      type: "radio",
      label: "Mode",
      options: [
        { label: "View Only", value: "view" },
        { label: "Editable", value: "edit" },
      ],
    },

    onEditAction: createActionsField(),

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

    textColor: textColorField,
    fontFamily: fontFamilyField,
  },

  // Only show onEditAction when mode is 'edit'
  resolveFields: (data, { fields }) => {
    if (data.props.mode !== 'edit') {
      const { onEditAction, ...rest } = fields;
      return rest;
    }
    return fields;
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "list",
    size: "normal",
    mode: "view",
    maxItems: 5,
    showSize: true,
    showDownload: true,
  },

  render: FileFieldRouter,
};

export default FileFieldConfig;
export type { FileFieldProps };
