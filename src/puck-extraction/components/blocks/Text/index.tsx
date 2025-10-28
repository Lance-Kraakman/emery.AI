import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Section } from "../../shared/Section";
import styles from "./styles.module.css";

export type TextProps = {
  text: string;
  size: "s" | "m" | "l" | "xl" | "xxl";
  align: "left" | "center" | "right";
  color: "default" | "muted";
  padding?: string;
  maxWidth?: string;
  weight?: "normal" | "medium" | "semibold" | "bold";
};

const getFontSize = (size?: string) => {
  switch (size) {
    case "s":
      return "12px";
    case "m":
      return "20px";
    case "l":
      return "24px";
    case "xl":
      return "32px";
    case "xxl":
      return "40px";
    default:
      return "16px";
  }
};

const getFontWeight = (weight?: string) => {
  switch (weight) {
    case "medium":
      return 500;
    case "semibold":
      return 600;
    case "bold":
      return 700;
    default:
      return 400;
  }
};

const TextComponent: React.FC<TextProps> = ({
  text,
  size,
  align,
  color,
  padding,
  maxWidth,
  weight,
}) => {
  return (
    <Section padding={padding} maxWidth={maxWidth}>
      <div className="relative">
        <span
          className={styles.text}
          style={{
            color:
              color === "default" ? "inherit" : "var(--puck-color-grey-05)",
            display: "flex",
            textAlign: align,
            width: "100%",
            fontSize: getFontSize(size),
            fontWeight: getFontWeight(weight),
            maxWidth,
            marginLeft: "auto",
            marginRight: "auto",
            justifyContent:
              align === "center"
                ? "center"
                : align === "right"
                  ? "flex-end"
                  : "flex-start",
          }}
        >
          {text}
        </span>
      </div>
    </Section>
  );
};

export const Text: ComponentConfig<TextProps> = {
  fields: {
    text: { type: "textarea" },
    size: {
      type: "select",
      options: [
        { label: "S", value: "s" },
        { label: "M", value: "m" },
        { label: "L", value: "l" },
        { label: "XL", value: "xl" },
        { label: "XXL", value: "xxl" },
      ],
    },
    weight: {
      type: "select",
      label: "Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
      ],
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    color: {
      type: "radio",
      options: [
        { label: "Default", value: "default" },
        { label: "Muted", value: "muted" },
      ],
    },
    padding: { type: "text" },
    maxWidth: { type: "text" },
  },
  defaultProps: {
    align: "left",
    text: "Hello",
    padding: "0px",
    size: "s",
    color: "default",
    weight: "normal",
    maxWidth: "100%",
  },
  render: (props) => <TextComponent {...props} />,
};
