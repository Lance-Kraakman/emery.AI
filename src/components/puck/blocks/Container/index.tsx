import React from "react";
import { ComponentConfig, Slot } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { withLayout } from "../../components/Layout";
import {
  backgroundColorField,
  borderColorField,
  borderRadiusField,
  paddingField,
} from "../../fields/standard-fields";

const getClassName = getClassNameFactory("Container", styles);

export type ContainerProps = {
  variant: "card" | "bordered" | "subtle" | "none";
  shadow?: "none" | "sm" | "md" | "lg";
  sticky?: boolean;
  stickyPosition?: "top" | "bottom";
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: string;
  paddingLevel?: string;
  children: Slot;
};

export const ContainerInternal: ComponentConfig<ContainerProps> = {
  fields: {
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { value: "card", label: "Card" },
        { value: "bordered", label: "Bordered" },
        { value: "subtle", label: "Subtle" },
        { value: "none", label: "None" },
      ],
    },
    shadow: {
      type: "select",
      label: "Shadow",
      options: [
        { value: "none", label: "None" },
        { value: "sm", label: "Small" },
        { value: "md", label: "Medium" },
        { value: "lg", label: "Large" },
      ],
    },
    sticky: {
      type: "radio",
      label: "Sticky",
      options: [
        { value: false, label: "Off" },
        { value: true, label: "On" },
      ],
    },
    stickyPosition: {
      type: "radio",
      label: "Sticky Position",
      options: [
        { value: "top", label: "Top" },
        { value: "bottom", label: "Bottom" },
      ],
    },
    backgroundColor: backgroundColorField,
    borderColor: borderColorField,
    borderRadius: borderRadiusField,
    paddingLevel: paddingField,
    children: {
      type: "slot",
    },
  },
  defaultProps: {
    variant: "card",
    shadow: undefined,
    sticky: false,
    stickyPosition: "top",
    backgroundColor: undefined,
    borderColor: undefined,
    borderRadius: undefined,
    paddingLevel: undefined,
    children: [],
  },
  resolveFields: (data) => {
    const fields: ComponentConfig<ContainerProps>["fields"] = {
      variant: {
        type: "radio",
        label: "Style",
        options: [
          { value: "card", label: "Card" },
          { value: "bordered", label: "Bordered" },
          { value: "subtle", label: "Subtle" },
          { value: "none", label: "None" },
        ],
      },
      shadow: {
        type: "select",
        label: "Shadow",
        options: [
          { value: "none", label: "None" },
          { value: "sm", label: "Small" },
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
        ],
      },
      sticky: {
        type: "radio",
        label: "Sticky",
        options: [
          { value: false, label: "Off" },
          { value: true, label: "On" },
        ],
      },
      stickyPosition: {
        type: "radio",
        label: "Sticky Position",
        options: [
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" },
        ],
      },
      backgroundColor: backgroundColorField,
      borderColor: borderColorField,
      borderRadius: borderRadiusField,
      paddingLevel: paddingField,
      children: {
        type: "slot",
      },
    };

    // Only show borderColor for bordered variant
    if (data.props.variant !== "bordered") {
      delete fields.borderColor;
    }

    // Only show stickyPosition when sticky is enabled
    if (!data.props.sticky) {
      delete fields.stickyPosition;
    }

    return fields;
  },
  render: ({
    variant,
    shadow,
    sticky,
    stickyPosition = "top",
    backgroundColor,
    borderColor,
    borderRadius,
    paddingLevel,
    children: Children,
  }) => {
    const padding = paddingLevel
      ? `calc(var(--theme-spacing-unit, 0.25rem) * ${paddingLevel})`
      : undefined;

    // Determine effective shadow - card variant defaults to md if not specified
    const effectiveShadow = shadow ?? (variant === "card" ? "md" : "none");

    return (
      <div
        className={getClassName({
          [variant]: true,
          [`shadow-${effectiveShadow}`]: effectiveShadow !== "none",
        })}
        style={{
          ...(backgroundColor && { backgroundColor }),
          ...(borderColor && { borderColor }),
          ...(borderRadius && { borderRadius }),
          ...(padding && { padding }),
          // Note: sticky styles are applied to the outer Layout wrapper by withLayout HOC
        }}
      >
        <Children />
      </div>
    );
  },
};

export const Container = withLayout(ContainerInternal);
