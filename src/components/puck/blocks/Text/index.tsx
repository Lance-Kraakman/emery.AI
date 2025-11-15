import React from "react";
import { AlignLeft } from "lucide-react";

import { ComponentConfig } from "@measured/puck";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { typographySizeField, backgroundColorField, textColorField } from "../../fields/standard-fields";
import type { TypographySize } from "../../utils/typography";
import styles from "./styles.module.css";

export type TextProps = WithLayout<{
  align: "left" | "center" | "right";
  text?: string;
  size: TypographySize;
  textColor?: string;
  backgroundColor?: string;
  maxWidth?: string;
}>;

const TextInner: ComponentConfig<TextProps> = {
  fields: {
    text: {
      type: "textarea",
      contentEditable: true,
    },
    size: typographySizeField,
    align: {
      type: "radio",
      labelIcon: <AlignLeft size={16} />,
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    textColor: textColorField,
    backgroundColor: backgroundColorField,
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
  },
  render: ({ align, textColor, backgroundColor, text, size, maxWidth }) => {
    return (
      <Section maxWidth={maxWidth}>
        <p
          className={styles.text}
          data-size={size}
          style={{
            textAlign: align,
            ...(textColor && { color: textColor }),
            ...(backgroundColor && { backgroundColor }),
          }}
        >
          {text}
        </p>
      </Section>
    );
  },
};

export const Text = withLayout(TextInner);
