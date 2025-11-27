import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Button as _Button } from "@/components/puck/components/Button";
import { createActionsField } from "@/components/puck/custom-fields";
import type { Action } from "../../types/actions";

export type ButtonProps = {
  label: string;
  actions?: Action[];
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
    actions: createActionsField(),
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
    actions: [],
    variant: "primary",
  },
  render: ({ actions, variant, label, puck }) => {
    return (
      <div>
        <_Button
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
