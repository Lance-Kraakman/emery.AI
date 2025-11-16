/* eslint-disable @next/next/no-img-element */
import React, { ReactElement } from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import dynamic from "next/dynamic";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { withLayout, WithLayout } from "../../components/Layout";
import { backgroundColorField, textColorField, fontFamilyField, fontWeightField, borderRadiusField, borderWidthField, paddingField } from "../../fields/standard-fields";

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
  borderRadius?: string;
  borderWidth?: string;
  paddingLevel?: string;
}>;

const CardInner: ComponentConfig<CardProps> = {
  fields: {
    title: {
      type: "text",
      contentEditable: true,
    },
    description: {
      type: "textarea",
      contentEditable: true,
    },
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
    borderRadius: borderRadiusField,
    borderWidth: borderWidthField,
    paddingLevel: paddingField,
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
    borderRadius: undefined,
    borderWidth: undefined,
    paddingLevel: undefined,
  },
  render: ({ title, icon, description, mode, titleColor, textColor, backgroundColor, titleFontFamily, titleFontWeight, textFontFamily, textFontWeight, borderRadius, borderWidth, paddingLevel }) => {
    // Calculate padding from level if provided
    const padding = paddingLevel ? `calc(var(--theme-spacing-unit, 0.25rem) * ${paddingLevel})` : undefined;

    return (
      <div
        className={getClassName({ [mode]: mode })}
        style={{
          ...(backgroundColor && { backgroundColor }),
          ...(borderRadius && { borderRadius }),
          ...(borderWidth && { borderWidth }),
          ...(padding && { padding }),
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
            {title}
          </div>
          <div
            className={getClassName("description")}
            style={{
              ...(textColor && { color: textColor }),
              ...(textFontFamily && { fontFamily: textFontFamily }),
              ...(textFontWeight && { fontWeight: textFontWeight }),
            }}
          >
            {description}
          </div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);
