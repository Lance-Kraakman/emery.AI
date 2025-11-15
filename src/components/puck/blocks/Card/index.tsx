/* eslint-disable @next/next/no-img-element */
import React, { ReactElement } from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import dynamic from "next/dynamic";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { withLayout, WithLayout } from "../../components/Layout";
import { backgroundColorField, textColorField } from "../../fields/standard-fields";

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
  },
  defaultProps: {
    title: "Title",
    description: "Description",
    icon: "Feather",
    mode: "flat",
    titleColor: undefined,
    textColor: undefined,
    backgroundColor: undefined,
  },
  render: ({ title, icon, description, mode, titleColor, textColor, backgroundColor }) => {
    return (
      <div
        className={getClassName({ [mode]: mode })}
        style={{ ...(backgroundColor && { backgroundColor }) }}
      >
        <div className={getClassName("inner")}>
          <div className={getClassName("icon")}>{icon && icons[icon]}</div>

          <div
            className={getClassName("title")}
            style={{ ...(titleColor && { color: titleColor }) }}
          >
            {title}
          </div>
          <div
            className={getClassName("description")}
            style={{ ...(textColor && { color: textColor }) }}
          >
            {description}
          </div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);
