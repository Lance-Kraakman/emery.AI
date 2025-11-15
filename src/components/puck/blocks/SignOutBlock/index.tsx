"use client";

import React from "react";
import { ComponentConfig } from "@measured/puck";
import { SignOutBlock as _SignOutBlock } from "./SignOutBlock";

export type SignOutBlockProps = {
  buttonText: string;
  showUserInfo: boolean;
  redirectAfterSignOut: string;
  variant: "default" | "destructive" | "outline" | "secondary" | "ghost";
};

export const SignOutBlock: ComponentConfig<SignOutBlockProps> = {
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
  },
  defaultProps: {
    buttonText: "Sign Out",
    showUserInfo: true,
    redirectAfterSignOut: "",
    variant: "outline",
  },
  render: (props) => {
    return <_SignOutBlock {...props} />;
  },
};
