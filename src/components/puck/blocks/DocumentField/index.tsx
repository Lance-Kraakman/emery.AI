/**
 * DocumentField - Puck Component Configuration
 *
 * Field block for displaying document fields from data context.
 * Category: "Fields" - Data display blocks that require context
 * Supports view-only and edit modes with configurable edit actions.
 */

import type { ComponentConfig } from "@measured/puck";
import DocumentField from "./DocumentField";
import DocumentEditMode from "./DocumentEditMode";
import { createFieldSelectorField, createActionsField } from "../../custom-fields";
import {
  labelPositionField,
  textColorField,
  fontFamilyField,
} from "../../fields/standard-fields";
import type { DocumentFieldProps } from "./types";

/**
 * Router component that renders the appropriate mode
 */
function DocumentFieldRouter(props: DocumentFieldProps) {
  if (props.mode === 'edit') {
    return <DocumentEditMode {...props} />;
  }
  return <DocumentField {...props} />;
}

export const DocumentFieldConfig: ComponentConfig<DocumentFieldProps> = {
  label: "Document Field",

  fields: {
    fieldId: createFieldSelectorField({
      label: "Field",
      filterTypes: ["document"],
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
      label: "Max Documents to Show",
      min: 1,
      max: 20,
    },

    showMetadata: {
      type: "radio",
      label: "Show Metadata (size, pages)",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    showStatus: {
      type: "radio",
      label: "Show Processing Status",
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
    showMetadata: true,
    showStatus: true,
  },

  render: DocumentFieldRouter,
};

export default DocumentFieldConfig;
export type { DocumentFieldProps };
