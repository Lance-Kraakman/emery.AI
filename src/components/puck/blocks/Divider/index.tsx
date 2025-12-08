import React from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { withLayout } from "../../components/Layout";
import { borderColorField, spacingField } from "../../fields/standard-fields";

const getClassName = getClassNameFactory("Divider", styles);

export type DividerProps = {
  direction: "horizontal" | "vertical";
  thickness?: string;
  color?: string;
  lineStyle?: "solid" | "dashed" | "dotted";
  spacing?: string;
  width?: "full" | "75%" | "50%" | "25%";
};

export const DividerInternal: ComponentConfig<DividerProps> = {
  fields: {
    direction: {
      type: "radio",
      label: "Direction",
      options: [
        { value: "horizontal", label: "Horizontal" },
        { value: "vertical", label: "Vertical" },
      ],
    },
    width: {
      type: "select",
      label: "Width",
      options: [
        { value: "full", label: "Full" },
        { value: "75%", label: "75%" },
        { value: "50%", label: "50%" },
        { value: "25%", label: "25%" },
      ],
    },
    thickness: {
      type: "select",
      label: "Thickness",
      options: [
        { value: "1px", label: "Thin (1px)" },
        { value: "2px", label: "Medium (2px)" },
        { value: "3px", label: "Thick (3px)" },
        { value: "4px", label: "Extra Thick (4px)" },
      ],
    },
    lineStyle: {
      type: "radio",
      label: "Style",
      options: [
        { value: "solid", label: "Solid" },
        { value: "dashed", label: "Dashed" },
        { value: "dotted", label: "Dotted" },
      ],
    },
    color: borderColorField,
    spacing: {
      ...spacingField,
      label: "Spacing (above/below)",
    },
  },
  defaultProps: {
    direction: "horizontal",
    thickness: "1px",
    lineStyle: "solid",
    spacing: "4",
    width: "full",
    color: undefined,
  },
  render: ({ direction, thickness, color, lineStyle, spacing, width }) => {
    const marginValue = spacing ? `var(--spacing-${spacing}, 1rem)` : undefined;

    const widthValue = width === "full" ? "100%" : width;

    const style: React.CSSProperties =
      direction === "horizontal"
        ? {
            width: widthValue,
            borderTopWidth: thickness,
            borderTopStyle: lineStyle,
            borderTopColor: color || "var(--theme-border, #e2e8f0)",
            marginTop: marginValue,
            marginBottom: marginValue,
          }
        : {
            height: "100%",
            minHeight: "1rem",
            borderLeftWidth: thickness,
            borderLeftStyle: lineStyle,
            borderLeftColor: color || "var(--theme-border, #e2e8f0)",
            marginLeft: marginValue,
            marginRight: marginValue,
          };

    return (
      <div
        className={getClassName({
          horizontal: direction === "horizontal",
          vertical: direction === "vertical",
        })}
        style={style}
      />
    );
  },
};

export const Divider = withLayout(DividerInternal);
