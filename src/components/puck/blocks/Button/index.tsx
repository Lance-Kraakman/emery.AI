"use client";

import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Button as _Button } from "@/components/puck/components/Button";
import { createActionsField, createVariableLabelField } from "@/components/puck/custom-fields";
import { useResolveVariables } from "../../hooks/useResolveVariables";
import type { Action } from "../../types/actions";

export type ButtonProps = {
  label: string;
  actions?: Action[];
  variant: "primary" | "secondary";
};

/**
 * Button render component that resolves variable templates in label
 */
function ButtonRender({
  actions,
  variant,
  label,
  puck,
}: ButtonProps & { puck: { isEditing: boolean } }) {
  const resolveVariables = useResolveVariables();
  const resolvedLabel = resolveVariables(label);

  return (
    <div>
      <_Button
        actions={actions}
        variant={variant}
        size="large"
        isEditing={puck.isEditing}
        tabIndex={puck.isEditing ? -1 : undefined}
      >
        {resolvedLabel}
      </_Button>
    </div>
  );
}

export const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: createVariableLabelField({ placeholder: "Button text (use {fieldName} for dynamic values)" }),
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
  render: ButtonRender,
};
