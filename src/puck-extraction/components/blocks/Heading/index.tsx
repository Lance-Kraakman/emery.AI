import React from "react";
import { ComponentConfig } from "@measured/puck";
import { Section } from "../../shared/Section";

export type HeadingProps = {
  text: string;
  type: HeadingType;
  align: "left" | "center" | "right";
  color: "default" | "muted";
  padding?: string;
  maxWidth?: string;
  weight?: "normal" | "medium" | "semibold" | "bold";
};

type HeadingType = "title" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const headingSizeMap: Record<HeadingType, string> = {
  title: "40px",
  h1: "32px",
  h2: "24px",
  h3: "20px",
  h4: "18px",
  h5: "16px",
  h6: "14px",
};

const getSizeFromHeadingType = (headingType: HeadingType): string => {
  return headingSizeMap[headingType];
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

const HeadingComponent: React.FC<HeadingProps> = ({
  text,
  type,
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
          style={{
            color:
              color === "default" ? "inherit" : "var(--puck-color-grey-05)",
            display: "flex",
            textAlign: align,
            width: "100%",
            fontSize: getSizeFromHeadingType(type),
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

export const Heading: ComponentConfig<HeadingProps> = {
  fields: {
    text: { type: "textarea" },
    type: {
      type: "select",
      options: [
        { label: "Title", value: "title" as HeadingType },
        { label: "Heading 1", value: "h1" as HeadingType },
        { label: "Heading 2", value: "h2" as HeadingType },
        { label: "Heading 3", value: "h3" as HeadingType },
        { label: "Heading 4", value: "h4" as HeadingType },
        { label: "Heading 5", value: "h5" as HeadingType },
        { label: "Heading 6", value: "h6" as HeadingType },
      ],
    },
    weight: {
      type: "select",
      label: "weight",
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
    text: "This is a Heading",
    type: "h1",
    align: "center",
    padding: "0px",
    color: "default",
    weight: "normal",
    maxWidth: "100%",
  },
  render: (props) => <HeadingComponent {...props} />,
};
