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
import { createLinkActionField, createVariableTextField, createRoleSelectorField, type LinkActionConfig, type RoleSelectorFieldValue } from "@/components/puck/custom-fields";
import type { FourCornerRadius } from "@/components/puck/types/spacing-types";

export type LoginBlockProps = {
  mode: 'sign_in' | 'sign_up' | 'dual';
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAction: LinkActionConfig;
  // Sign-up role assignment
  defaultSignUpRole: RoleSelectorFieldValue | null;
  // Theme fields
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  radius?: FourCornerRadius;
};

export const SignInSignUpBlock: ComponentConfig<LoginBlockProps> = {
  label: "Sign In / Sign Up",
  fields: {
    mode: {
      type: "radio",
      label: "Mode",
      options: [
        { label: "Sign In", value: "sign_in" },
        { label: "Sign Up", value: "sign_up" },
        { label: "Dual (with toggle)", value: "dual" },
      ],
    },
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
    defaultSignUpRole: createRoleSelectorField({
      placeholder: "Select default role for new sign-ups",
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
    mode: 'sign_in',
    title: "Sign In",
    description: "Sign in to access this content",
    showGithub: true,
    showGoogle: true,
    showEmail: true,
    redirectAction: {
      actionType: 'none',
    },
    defaultSignUpRole: null,
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
