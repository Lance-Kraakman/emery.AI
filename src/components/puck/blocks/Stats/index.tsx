/* eslint-disable @next/next/no-img-element */
import React from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { backgroundColorField, textColorField, fontFamilyField, fontWeightField, borderRadiusField, paddingField } from "../../fields/standard-fields";
import type { FourSidedSpacing, FourCornerRadius } from "../../types/spacing-types";
import { useTheme } from "../../contexts/PageContext";
import { computeFourSidedCSS, computeFourCornerRadiusCSS } from "../../utils/spacing";
import { createVariableTextField } from "../../custom-fields";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";

const getClassName = getClassNameFactory("Stats", styles);

/** Helper component for rendering a stat item with variable interpolation */
function StatItem({
  title,
  description,
  labelColor,
  labelFontFamily,
  labelFontWeight,
  valueColor,
  valueFontFamily,
  valueFontWeight,
}: {
  title: string;
  description: string;
  labelColor?: string;
  labelFontFamily?: string;
  labelFontWeight?: string;
  valueColor?: string;
  valueFontFamily?: string;
  valueFontWeight?: string;
}) {
  const interpolatedTitle = useInterpolatedText(title);
  const interpolatedDescription = useInterpolatedText(description);

  return (
    <div className={getClassName("item")}>
      <div
        className={getClassName("label")}
        style={{
          ...(labelColor && { color: labelColor }),
          ...(labelFontFamily && { fontFamily: labelFontFamily }),
          ...(labelFontWeight && { fontWeight: labelFontWeight }),
        }}
      >
        {interpolatedTitle}
      </div>
      <div
        className={getClassName("value")}
        style={{
          ...(valueColor && { color: valueColor }),
          ...(valueFontFamily && { fontFamily: valueFontFamily }),
          ...(valueFontWeight && { fontWeight: valueFontWeight }),
        }}
      >
        {interpolatedDescription}
      </div>
    </div>
  );
}

export type StatsProps = {
  items: {
    title: string;
    description: string;
  }[];
  labelColor?: string;
  valueColor?: string;
  backgroundColor?: string;
  labelFontFamily?: string;
  labelFontWeight?: string;
  valueFontFamily?: string;
  valueFontWeight?: string;
  radius?: FourCornerRadius;
  padding?: FourSidedSpacing;
};

export const Stats: ComponentConfig<StatsProps> = {
  fields: {
    items: {
      type: "array",
      getItemSummary: (item, i) => item.title || `Feature #${i}`,
      defaultItemProps: {
        title: "Stat",
        description: "1,000",
      },
      arrayFields: {
        title: createVariableTextField({ label: 'Title' }),
        description: createVariableTextField({ label: 'Value' }),
      },
    },
    labelColor: {
      ...textColorField,
      label: "Label Color (Optional)",
    },
    valueColor: {
      ...textColorField,
      label: "Value Color (Optional)",
    },
    backgroundColor: backgroundColorField,
    labelFontFamily: {
      ...fontFamilyField,
      label: "Label Font Family (Optional)",
    },
    labelFontWeight: {
      ...fontWeightField,
      label: "Label Font Weight (Optional)",
    },
    valueFontFamily: {
      ...fontFamilyField,
      label: "Value Font Family (Optional)",
    },
    valueFontWeight: {
      ...fontWeightField,
      label: "Value Font Weight (Optional)",
    },
    radius: borderRadiusField,
    padding: paddingField,
  },
  defaultProps: {
    items: [
      {
        title: "Stat",
        description: "1,000",
      },
    ],
    labelColor: undefined,
    valueColor: undefined,
    backgroundColor: undefined,
    labelFontFamily: undefined,
    labelFontWeight: undefined,
    valueFontFamily: undefined,
    valueFontWeight: undefined,
    radius: undefined,
    padding: undefined,
  },
  render: function StatsRender({ items, labelColor, valueColor, backgroundColor, labelFontFamily, labelFontWeight, valueFontFamily, valueFontWeight, radius, padding }) {
    const theme = useTheme();
    const paddingStyles = padding ? computeFourSidedCSS(padding, theme, 'padding') : {};
    const radiusStyles = radius ? computeFourCornerRadiusCSS(radius, theme) : {};

    return (
      <Section className={getClassName()} maxWidth={"916px"}>
        <div
          className={getClassName("items")}
          style={{
            ...(backgroundColor && { backgroundImage: 'none', backgroundColor }),
            ...radiusStyles,
            ...paddingStyles,
          }}
        >
          {items.map((item, i) => (
            <StatItem
              key={i}
              title={item.title}
              description={item.description}
              labelColor={labelColor}
              labelFontFamily={labelFontFamily}
              labelFontWeight={labelFontWeight}
              valueColor={valueColor}
              valueFontFamily={valueFontFamily}
              valueFontWeight={valueFontWeight}
            />
          ))}
        </div>
      </Section>
    );
  },
};
