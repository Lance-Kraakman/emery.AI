import React from "react";

import { ComponentConfig } from "@measured/puck";
import { Heading as _Heading } from "@/components/puck/components/Heading";
import type { HeadingProps as _HeadingProps } from "@/components/puck/components/Heading";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { typographySizeField, backgroundColorField, textColorField } from "../../fields/standard-fields";

export type HeadingProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  level?: _HeadingProps["rank"];
  size: _HeadingProps["size"];
  textColor?: string;
  backgroundColor?: string;
}>;

const levelOptions = [
  { label: "", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: {
      type: "textarea",
      contentEditable: true,
    },
    size: typographySizeField,
    level: {
      type: "select",
      options: levelOptions,
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    textColor: textColorField,
    backgroundColor: backgroundColorField,
  },
  defaultProps: {
    align: "left",
    text: "Heading",
    size: "2xl",
    textColor: undefined,
    backgroundColor: undefined,
    layout: {
      padding: "8px",
    },
  },
  render: ({ align, text, size, level, textColor, backgroundColor }) => {
    return (
      <Section>
        <_Heading size={size} rank={level as any}>
          <span
            style={{
              display: "block",
              textAlign: align,
              width: "100%",
              ...(textColor && { color: textColor }),
              ...(backgroundColor && { backgroundColor }),
            }}
          >
            {text}
          </span>
        </_Heading>
      </Section>
    );
  },
};

export const Heading = withLayout(HeadingInternal);
