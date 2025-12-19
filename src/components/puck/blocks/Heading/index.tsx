'use client';

import React from "react";

import { ComponentConfig } from "@measured/puck";
import { Heading as _Heading } from "@/components/puck/components/Heading";
import type { HeadingProps as _HeadingProps } from "@/components/puck/components/Heading";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { typographySizeField, backgroundColorField, textColorField, fontFamilyField, fontWeightField, textAlignField } from "../../fields/standard-fields";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";
import { createVariableTextField } from "../../custom-fields";

export type HeadingProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  level?: _HeadingProps["rank"];
  size: _HeadingProps["size"];
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontWeight?: string;
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

/**
 * Heading render component - supports variable interpolation
 * Text like "Welcome {state.user.name}!" becomes "Welcome John!"
 */
function HeadingRender({
  align,
  text,
  size,
  level,
  textColor,
  backgroundColor,
  fontFamily,
  fontWeight,
}: HeadingProps) {
  // Interpolate variables in text
  const interpolatedText = useInterpolatedText(text);

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
            ...(fontFamily && { fontFamily }),
            ...(fontWeight && { fontWeight }),
          }}
        >
          {interpolatedText}
        </span>
      </_Heading>
    </Section>
  );
}

const HeadingInternal: ComponentConfig<HeadingProps> = {
  fields: {
    text: createVariableTextField({ label: 'Text', multiline: true }),
    size: typographySizeField,
    level: {
      type: "select",
      options: levelOptions,
    },
    align: textAlignField,
    textColor: textColorField,
    backgroundColor: backgroundColorField,
    fontFamily: fontFamilyField,
    fontWeight: fontWeightField,
  },
  defaultProps: {
    align: "left",
    text: "Heading",
    size: "2xl",
    textColor: undefined,
    backgroundColor: undefined,
    fontFamily: undefined,
    fontWeight: undefined,
    layout: {},
  },
  render: HeadingRender,
};

export const Heading = withLayout(HeadingInternal);
