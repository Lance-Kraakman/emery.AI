"use client";

import React from "react";
import { ComponentConfig } from "@measured/puck";
import { LoginBlock as _LoginBlock } from "./LoginBlock";
import {
  backgroundColorField,
  textColorField,
  borderColorField,
  borderRadiusField
} from "@/components/puck/fields/standard-fields";
import { createLinkActionField, createVariableTextField, type LinkActionConfig } from "@/components/puck/custom-fields";
import type { FourCornerRadius } from "@/components/puck/types/spacing-types";

export type LoginBlockProps = {
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAction: LinkActionConfig;
  // Theme fields
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  radius?: FourCornerRadius;
};

export const LoginBlock: ComponentConfig<LoginBlockProps> = {
  label: "Login",
  fields: {
    title: createVariableTextField({ label: 'Title' }),
    description: createVariableTextField({ label: 'Description', multiline: true }),
    showGithub: {
      type: "radio",
      label: "Show GitHub Login",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showGoogle: {
      type: "radio",
      label: "Show Google Login",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showEmail: {
      type: "radio",
      label: "Show Email Login",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    redirectAction: createLinkActionField({
      label: "Redirect After Login",
      allowedActionTypes: ['none', 'page', 'url'],
      defaultActionType: 'none',
    }),
    backgroundColor: backgroundColorField,
    textColor: textColorField,
    buttonColor: {
      ...textColorField,
      label: "Button Color (Optional)",
    },
    buttonTextColor: {
      ...textColorField,
      label: "Button Text Color (Optional)",
    },
    borderColor: borderColorField,
    radius: borderRadiusField,
  },
  defaultProps: {
    title: "Sign In",
    description: "Sign in to access this content",
    showGithub: true,
    showGoogle: true,
    showEmail: true,
    redirectAction: {
      actionType: 'none',
    },
    backgroundColor: undefined,
    textColor: undefined,
    buttonColor: undefined,
    buttonTextColor: undefined,
    borderColor: undefined,
    radius: undefined,
  },
  render: (props) => {
    return <_LoginBlock {...props} />;
  },
};
