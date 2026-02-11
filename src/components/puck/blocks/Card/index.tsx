 
import React, { ReactElement } from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import dynamic from "next/dynamic";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { withLayout, WithLayout } from "../../components/Layout";
import { backgroundColorField, textColorField, fontFamilyField, fontWeightField, borderRadiusField, borderWidthField, paddingField } from "../../fields/standard-fields";
import type { FourSidedSpacing, FourCornerRadius } from "../../types/spacing-types";
import { useTheme } from "../../contexts/PageContext";
import { computeFourSidedCSS, computeFourCornerRadiusCSS } from "../../utils/spacing";
import { createVariableTextField } from "../../custom-fields";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";

const getClassName = getClassNameFactory("Card", styles);

const icons = Object.keys(dynamicIconImports).reduce<
  Record<string, ReactElement>
>((acc, iconName) => {
  const El = dynamic((dynamicIconImports as any)[iconName]);

  return {
    ...acc,
    [iconName]: <El />,
  };
}, {});

const iconOptions = Object.keys(dynamicIconImports).map((iconName) => ({
  label: iconName,
  value: iconName,
}));

export type CardProps = WithLayout<{
  title: string;
  description: string;
  icon?: string;
  mode: "flat" | "card";
  titleColor?: string;
  textColor?: string;
  backgroundColor?: string;
  titleFontFamily?: string;
  titleFontWeight?: string;
  textFontFamily?: string;
  textFontWeight?: string;
  radius?: FourCornerRadius;
  borderWidth?: string;
  padding?: FourSidedSpacing;
}>;

const CardInner: ComponentConfig<CardProps> = {
  fields: {
    title: createVariableTextField({ label: 'Title' }),
    description: createVariableTextField({ label: 'Description', multiline: true }),
    icon: {
      type: "select",
      options: iconOptions,
    },
    mode: {
      type: "radio",
      options: [
        { label: "card", value: "card" },
        { label: "flat", value: "flat" },
      ],
    },
    titleColor: {
      ...textColorField,
      label: "Title Color (Optional)",
    },
    textColor: {
      ...textColorField,
      label: "Text Color (Optional)",
    },
    backgroundColor: backgroundColorField,
    titleFontFamily: {
      ...fontFamilyField,
      label: "Title Font Family (Optional)",
    },
    titleFontWeight: {
      ...fontWeightField,
      label: "Title Font Weight (Optional)",
    },
    textFontFamily: {
      ...fontFamilyField,
      label: "Text Font Family (Optional)",
    },
    textFontWeight: {
      ...fontWeightField,
      label: "Text Font Weight (Optional)",
    },
    radius: borderRadiusField,
    borderWidth: borderWidthField,
    padding: paddingField,
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    icon: "Feather",
    mode: "flat",
    titleColor: undefined,
    textColor: undefined,
    backgroundColor: undefined,
    titleFontFamily: undefined,
    titleFontWeight: undefined,
    textFontFamily: undefined,
    textFontWeight: undefined,
    radius: undefined,
    borderWidth: undefined,
    padding: undefined,
  },
  render: function CardRender({ title, icon, description, mode, titleColor, textColor, backgroundColor, titleFontFamily, titleFontWeight, textFontFamily, textFontWeight, radius, borderWidth, padding }) {
    const theme = useTheme();
    // Interpolate variables in title and description
    const interpolatedTitle = useInterpolatedText(title);
    const interpolatedDescription = useInterpolatedText(description);

    // Compute styles from FourSided/FourCorner values
    const paddingStyles = padding ? computeFourSidedCSS(padding, theme, 'padding') : {};
    const radiusStyles = radius ? computeFourCornerRadiusCSS(radius, theme) : {};

    return (
      <div
        className={getClassName({ [mode]: mode })}
        style={{
          ...(backgroundColor && { backgroundColor }),
          ...radiusStyles,
          ...(borderWidth && { borderWidth }),
          ...paddingStyles,
        }}
      >
        <div className={getClassName("inner")}>
          <div className={getClassName("icon")}>{icon && icons[icon]}</div>

          <div
            className={getClassName("title")}
            style={{
              ...(titleColor && { color: titleColor }),
              ...(titleFontFamily && { fontFamily: titleFontFamily }),
              ...(titleFontWeight && { fontWeight: titleFontWeight }),
            }}
          >
            {interpolatedTitle}
          </div>
          <div
            className={getClassName("description")}
            style={{
              ...(textColor && { color: textColor }),
              ...(textFontFamily && { fontFamily: textFontFamily }),
              ...(textFontWeight && { fontWeight: textFontWeight }),
            }}
          >
            {interpolatedDescription}
          </div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);
