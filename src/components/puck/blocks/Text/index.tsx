'use client';

import React from "react";
import { AlignLeft } from "lucide-react";

import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { typographySizeField, backgroundColorField, textColorField, fontFamilyField, fontWeightField, textAlignField } from "../../fields/standard-fields";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";
import type { TypographySize } from "../../utils/typography";
import styles from "./styles.module.css";

export type TextProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  size: TypographySize;
  textColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  maxWidth?: string;
}>;

/**
 * Text render component - supports variable interpolation
 * Text like "Hello {state.user.name}!" becomes "Hello John!"
 */
function TextRender({
  align,
  textColor,
  backgroundColor,
  fontFamily,
  fontWeight,
  text,
  size,
  maxWidth,
}: TextProps) {
  // Interpolate variables in text (e.g., {state.x.y}, {params.id})
  const interpolatedText = useInterpolatedText(text);

  return (
    <Section maxWidth={maxWidth}>
      <p
        className={styles.text}
        data-size={size}
        style={{
          textAlign: align,
          ...(textColor && { color: textColor }),
          ...(backgroundColor && { backgroundColor }),
          ...(fontFamily && { fontFamily }),
          ...(fontWeight && { fontWeight }),
        }}
      >
        {interpolatedText}
      </p>
    </Section>
  );
}

const TextInner: ComponentConfig<TextProps> = {
  fields: {
    text: {
      type: "textarea",
      contentEditable: true,
    },
    size: typographySizeField,
    align: {
      ...textAlignField,
      labelIcon: <AlignLeft size={16} />,
    },
    textColor: textColorField,
    backgroundColor: backgroundColorField,
    fontFamily: fontFamilyField,
    fontWeight: fontWeightField,
    maxWidth: {
      type: "text",
      label: "Max Width",
    },
  },
  defaultProps: {
    align: "left",
    text: "Text",
    size: "base",
    textColor: undefined,
    backgroundColor: undefined,
    fontFamily: undefined,
    fontWeight: undefined,
  },
  render: TextRender,
};

export const Text = withLayout(TextInner);
