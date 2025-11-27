import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Button as _Button } from "@/components/puck/components/Button";
import { createLinkActionField, createActionsField, type LinkActionConfig } from "@/components/puck/custom-fields";
import type { Action } from "../../types/actions";

export type ButtonProps = {
  label: string;
  action: LinkActionConfig; // Legacy action system (kept for backwards compatibility)
  actions?: Action[]; // New actions system
  variant: "primary" | "secondary";
};

export const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: {
      type: "text",
      placeholder: "Button text",
      contentEditable: true,
    },
    action: createLinkActionField({
      label: "Button Action (Legacy)",
    }),
    actions: createActionsField(), // New actions system
    variant: {
      type: "radio",
      options: [
        { label: "primary", value: "primary" },
        { label: "secondary", value: "secondary" },
      ],
    },
  },
  defaultProps: {
    label: "Button",
    action: {
      actionType: "none",
    },
    actions: [],
    variant: "primary",
  },
  render: ({ action, actions, variant, label, puck }) => {
    return (
      <div>
        <_Button
          action={action}
          actions={actions}
          variant={variant}
          size="large"
          isEditing={puck.isEditing}
          tabIndex={puck.isEditing ? -1 : undefined}
        >
          {label}
        </_Button>
      </div>
    );
  },
};
