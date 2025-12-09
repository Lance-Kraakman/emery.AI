import React from "react";
import { ComponentConfig, Slot } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { WithLayout, withLayout } from "../../components/Layout";
import { spacingField, paddingField } from "../../fields/standard-fields";

const getClassName = getClassNameFactory("Flex", styles);

export type ItemStyle = "none" | "card" | "bordered" | "subtle";

export type FlexProps = WithLayout<{
  justifyContent: "start" | "center" | "end";
  direction: "row" | "column";
  gap: string;
  wrap: "wrap" | "nowrap";
  itemStyle?: ItemStyle;
  itemPadding?: string;
  items: Slot;
}>;

const FlexInternal: ComponentConfig<FlexProps> = {
  fields: {
    direction: {
      label: "Direction",
      type: "radio",
      options: [
        { label: "Row", value: "row" },
        { label: "Column", value: "column" },
      ],
    },
    justifyContent: {
      label: "Justify Content",
      type: "radio",
      options: [
        { label: "Start", value: "start" },
        { label: "Center", value: "center" },
        { label: "End", value: "end" },
      ],
    },
    gap: spacingField,
    wrap: {
      label: "Wrap",
      type: "radio",
      options: [
        { label: "true", value: "wrap" },
        { label: "false", value: "nowrap" },
      ],
    },
    itemStyle: {
      type: "select",
      label: "Item Style",
      options: [
        { value: "none", label: "None" },
        { value: "card", label: "Card" },
        { value: "bordered", label: "Bordered" },
        { value: "subtle", label: "Subtle" },
      ],
    },
    itemPadding: {
      ...paddingField,
      label: "Item Padding",
    },
    items: {
      type: "slot",
    },
  },
  defaultProps: {
    justifyContent: "start",
    direction: "row",
    gap: "4",
    wrap: "wrap",
    itemStyle: "none",
    itemPadding: undefined,
    layout: {
      grow: true,
    },
    items: [],
  },
  render: ({
    justifyContent,
    direction,
    gap,
    wrap,
    itemStyle,
    itemPadding,
    items: Items,
  }) => {
    const hasItemStyle = itemStyle && itemStyle !== "none";

    const itemPaddingStyle = itemPadding
      ? `calc(var(--theme-spacing-unit, 0.25rem) * ${itemPadding})`
      : undefined;

    return (
      <Section style={{ height: "100%" }}>
        <Items
          className={getClassName({
            hasItemStyle,
            [`item-${itemStyle}`]: hasItemStyle,
          })}
          style={{
            justifyContent,
            flexDirection: direction,
            gap: `var(--spacing-${gap}, 24px)`,
            flexWrap: wrap,
            ...(itemPaddingStyle && {
              "--flex-item-padding": itemPaddingStyle,
            }),
          } as React.CSSProperties}
          disallow={["Hero", "Stats"]}
        />
      </Section>
    );
  },
};

export const Flex = withLayout(FlexInternal);
