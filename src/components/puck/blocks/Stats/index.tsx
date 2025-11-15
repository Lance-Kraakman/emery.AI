/* eslint-disable @next/next/no-img-element */
import React from "react";
import { ComponentConfig } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { backgroundColorField, textColorField, fontFamilyField, fontWeightField } from "../../fields/standard-fields";

const getClassName = getClassNameFactory("Stats", styles);

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
        title: {
          type: "text",
          contentEditable: true,
        },
        description: {
          type: "text",
          contentEditable: true,
        },
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
  },
  render: ({ items, labelColor, valueColor, backgroundColor, labelFontFamily, labelFontWeight, valueFontFamily, valueFontWeight }) => {
    return (
      <Section className={getClassName()} maxWidth={"916px"}>
        <div
          className={getClassName("items")}
          style={{ ...(backgroundColor && { backgroundImage: 'none', backgroundColor }) }}
        >
          {items.map((item, i) => (
            <div key={i} className={getClassName("item")}>
              <div
                className={getClassName("label")}
                style={{
                  ...(labelColor && { color: labelColor }),
                  ...(labelFontFamily && { fontFamily: labelFontFamily }),
                  ...(labelFontWeight && { fontWeight: labelFontWeight }),
                }}
              >
                {item.title}
              </div>
              <div
                className={getClassName("value")}
                style={{
                  ...(valueColor && { color: valueColor }),
                  ...(valueFontFamily && { fontFamily: valueFontFamily }),
                  ...(valueFontWeight && { fontWeight: valueFontWeight }),
                }}
              >
                {item.description}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};
