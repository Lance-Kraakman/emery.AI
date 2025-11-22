import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Button as _Button } from "@/components/puck/components/Button";
import { createLinkActionField, type LinkActionConfig } from "@/components/puck/custom-fields";

export type ButtonProps = {
  label: string;
  action: LinkActionConfig;
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
      label: "Button Action",
    }),
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
    variant: "primary",
  },
  render: ({ action, variant, label, puck }) => {
    return (
      <div>
        <_Button
          action={action}
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
