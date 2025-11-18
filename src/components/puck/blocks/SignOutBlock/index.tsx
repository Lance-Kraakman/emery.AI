"use client";

import React from "react";
import { ComponentConfig } from "@measured/puck";
import { SignOutBlock as _SignOutBlock } from "./SignOutBlock";
import {
  backgroundColorField,
  textColorField,
  borderColorField,
  borderRadiusField
} from "@/components/puck/fields/standard-fields";
import { withLayout, WithLayout } from "../../components/Layout";

export type SignOutBlockProps = WithLayout<{
  buttonText: string;
  showUserInfo: boolean;
  showAvatar: boolean;
  redirectAfterSignOut: string;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost";
  popoverSide: "top" | "bottom" | "left" | "right";
  popoverAlign: "start" | "center" | "end";
  // Theme fields
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  borderColor?: string;
  borderRadius?: string;
}>;

const SignOutBlockInternal: ComponentConfig<SignOutBlockProps> = {
  label: "Sign Out",
  fields: {
    buttonText: {
      type: "text",
      label: "Button Text",
    },
    showUserInfo: {
      type: "radio",
      label: "Show User Info",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showAvatar: {
      type: "radio",
      label: "Show Avatar in Trigger",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    variant: {
      type: "select",
      label: "Button Style",
      options: [
        { label: "Default", value: "default" },
        { label: "Destructive", value: "destructive" },
        { label: "Outline", value: "outline" },
        { label: "Secondary", value: "secondary" },
        { label: "Ghost", value: "ghost" },
      ],
    },
    redirectAfterSignOut: {
      type: "text",
      label: "Redirect URL after sign out",
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
    buttonText: "Sign Out",
    showUserInfo: true,
    showAvatar: true,
    redirectAfterSignOut: "",
    variant: "outline",
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
    return <_SignOutBlock {...props} />;
  },
};

export const SignOutBlock = withLayout(SignOutBlockInternal);
