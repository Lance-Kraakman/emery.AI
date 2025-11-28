/**
 * ImageField - Puck Component Configuration
 *
 * Field block for displaying images from file/URL fields.
 * Category: "Fields"
 */

import type { ComponentConfig } from "@measured/puck";
import ImageField, { type ImageFieldProps } from "./ImageField";
import { createFieldSelectorField } from "../../custom-fields";
import { labelPositionField } from "../../fields/standard-fields";

export const ImageFieldConfig: ComponentConfig<ImageFieldProps> = {
  label: "Image Field",

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

    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small (64px)", value: "small" },
        { label: "Medium (128px)", value: "medium" },
        { label: "Large (256px)", value: "large" },
        { label: "Full Width", value: "full" },
      ],
    },

    shape: {
      type: "select",
      label: "Shape",
      options: [
        { label: "Square", value: "square" },
        { label: "Circle", value: "circle" },
        { label: "Rounded", value: "rounded" },
      ],
    },

    alt: {
      type: "text",
      label: "Alt Text",
    },

    fallbackUrl: {
      type: "text",
      label: "Fallback Image URL",
    },

    maxItems: {
      type: "number",
      label: "Max Images to Display",
      min: 1,
    },
  },

  defaultProps: {
    labelPosition: "top",
    size: "medium",
    shape: "rounded",
    alt: "Image",
    fallbackUrl: "",
    maxItems: 1,
  },

  render: ImageField,
};

export default ImageFieldConfig;
export type { ImageFieldProps };
