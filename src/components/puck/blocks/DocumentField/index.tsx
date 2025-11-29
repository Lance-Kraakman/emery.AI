/**
 * DocumentField - Puck Component Configuration
 *
 * Field block for displaying document fields from data context.
 * Category: "Fields" - Data display blocks that require context
 */

import type { ComponentConfig } from "@measured/puck";
import DocumentField, { type DocumentFieldProps } from "./DocumentField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

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
  },

  defaultProps: {
    labelPosition: "top",
    displayStyle: "list",
    maxItems: 5,
    showMetadata: true,
    showStatus: true,
  },

  render: DocumentField,
};

export default DocumentFieldConfig;
export type { DocumentFieldProps };
