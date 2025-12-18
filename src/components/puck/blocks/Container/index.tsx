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
  marginField,
} from "../../fields/standard-fields";
import type { FourSidedSpacing, FourCornerRadius } from "../../types/spacing-types";
import { useTheme } from "../../contexts/PageContext";
import { computeFourSidedCSS, computeFourCornerRadiusCSS } from "../../utils/spacing";

const getClassName = getClassNameFactory("Container", styles);

export type ContainerProps = {
  variant: "card" | "bordered" | "subtle" | "none";
  shadow?: "none" | "sm" | "md" | "lg";
  sticky?: boolean;
  stickyPosition?: "top" | "bottom";
  backgroundColor?: string;
  borderColor?: string;
  /** Per-corner border radius */
  radius?: FourCornerRadius;
  /** Per-side padding */
  padding?: FourSidedSpacing;
  /** Per-side margin */
  margin?: FourSidedSpacing;
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
    radius: borderRadiusField,
    padding: paddingField,
    margin: marginField,
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
    radius: undefined,
    padding: undefined,
    margin: undefined,
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
      radius: borderRadiusField,
      padding: paddingField,
      margin: marginField,
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
  render: function ContainerRender({
    variant,
    shadow,
    backgroundColor,
    borderColor,
    radius,
    padding,
    margin,
    children: Children,
  }) {
    const theme = useTheme();

    // Compute styles from FourSided/FourCorner values
    const paddingStyles = padding ? computeFourSidedCSS(padding, theme, 'padding') : {};
    const marginStyles = margin ? computeFourSidedCSS(margin, theme, 'margin') : {};
    const radiusStyles = radius ? computeFourCornerRadiusCSS(radius, theme) : {};

    // When horizontal margins are applied, calculate width to prevent overflow
    // (Container has width: 100% in CSS, so margins would cause overflow without this)
    const hasHorizontalMargin = margin && (margin.left > 0 || margin.right > 0);
    const widthStyle = hasHorizontalMargin
      ? { width: `calc(100% - ${marginStyles.marginLeft || '0px'} - ${marginStyles.marginRight || '0px'})` }
      : {};

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
          ...radiusStyles,
          ...paddingStyles,
          ...marginStyles,
          ...widthStyle,
        }}
      >
        <Children />
      </div>
    );
  },
};

export const Container = withLayout(ContainerInternal);
