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
import { createLinkActionField, type LinkActionConfig } from "@/components/puck/custom-fields";

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
  borderRadius?: string;
};

export const LoginBlock: ComponentConfig<LoginBlockProps> = {
  label: "Login",
  fields: {
    title: {
      type: "text",
      label: "Title",
    },
    description: {
      type: "textarea",
      label: "Description",
    },
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
    borderRadius: borderRadiusField,
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
    borderRadius: undefined,
  },
  render: (props) => {
    return <_LoginBlock {...props} />;
  },
};
