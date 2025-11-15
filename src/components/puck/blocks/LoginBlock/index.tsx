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

export type LoginBlockProps = {
  title: string;
  description: string;
  triggerText: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAfterLogin: string;
  popoverSide: "top" | "bottom" | "left" | "right";
  popoverAlign: "start" | "center" | "end";
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
    triggerText: {
      type: "text",
      label: "Button Text",
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
    redirectAfterLogin: {
      type: "text",
      label: "Redirect URL after login",
    },
    popoverSide: {
      type: "select",
      label: "Popover Position",
      options: [
        { label: "Bottom", value: "bottom" },
        { label: "Top", value: "top" },
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    popoverAlign: {
      type: "select",
      label: "Popover Alignment",
      options: [
        { label: "Center", value: "center" },
        { label: "Start", value: "start" },
        { label: "End", value: "end" },
      ],
    },
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
    triggerText: "Sign In",
    showGithub: true,
    showGoogle: true,
    showEmail: true,
    redirectAfterLogin: "",
    popoverSide: "bottom",
    popoverAlign: "center",
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
