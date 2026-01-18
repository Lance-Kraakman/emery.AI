/**
 * LinkBlock - Puck Component Configuration
 *
 * AIDEV-NOTE: Dedicated link component with action support.
 * Reuses the action system from Button for consistency.
 */

import type { ComponentConfig } from "@measured/puck";
import LinkBlock, { type LinkBlockProps } from "./LinkBlock";
import { createActionsField, createVariableLabelField } from "../../custom-fields";

export const LinkBlockConfig: ComponentConfig<LinkBlockProps> = {
  label: "Link",

  fields: {
    // Link properties
    label: createVariableLabelField({
      label: "Link Text",
      placeholder: "Link text (use {{fieldName}} for dynamic values)"
    }),

    href: {
      label: "URL",
      type: "text",
    },

    openInNewTab: {
      label: "Open in New Tab",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    // Styling
    style: {
      label: "Style",
      type: "select",
      options: [
        { label: "Inline Link", value: "inline" },
        { label: "Button Style", value: "button" },
        { label: "Navigation Item", value: "nav" },
      ],
    },

    variant: {
      label: "Variant (Button Style Only)",
      type: "select",
      options: [
        { label: "Default", value: "default" },
        { label: "Secondary", value: "secondary" },
        { label: "Outline", value: "outline" },
        { label: "Ghost", value: "ghost" },
        { label: "Link", value: "link" },
      ],
    },

    size: {
      label: "Size (Button Style Only)",
      type: "select",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "default" },
        { label: "Large", value: "lg" },
      ],
    },

    underline: {
      label: "Underline (Inline Style Only)",
      type: "radio",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },

    // Actions
    actions: createActionsField(),
  },

  defaultProps: {
    label: "Click here",
    href: "#",
    openInNewTab: false,
    style: "inline",
    variant: "default",
    size: "default",
    underline: true,
  },

  render: LinkBlock,
};

export default LinkBlockConfig;
