"use client";

import React from "react";
import { ComponentConfig } from "@measured/puck";
import { LoginBlock as _LoginBlock } from "./LoginBlock";

export type LoginBlockProps = {
  title: string;
  description: string;
  showGithub: boolean;
  showGoogle: boolean;
  showEmail: boolean;
  redirectAfterLogin: string;
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
    redirectAfterLogin: {
      type: "text",
      label: "Redirect URL after login",
    },
  },
  defaultProps: {
    title: "Sign In",
    description: "Sign in to access this content",
    showGithub: true,
    showGoogle: true,
    showEmail: true,
    redirectAfterLogin: "",
  },
  render: (props) => {
    return <_LoginBlock {...props} />;
  },
};
