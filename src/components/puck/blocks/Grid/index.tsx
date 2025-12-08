import React from "react";
import { ComponentConfig, Slot } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { withLayout } from "../../components/Layout";
import { spacingField, paddingField } from "../../fields/standard-fields";

const getClassName = getClassNameFactory("Grid", styles);

export type ItemStyle = "none" | "card" | "bordered" | "subtle";

export type GridProps = {
  numColumns: number;
  gap: string;
  itemStyle?: ItemStyle;
  itemPadding?: string;
  items: Slot;
};

export const GridInternal: ComponentConfig<GridProps> = {
  fields: {
    numColumns: {
      type: "number",
      label: "Number of columns",
      min: 1,
      max: 12,
    },
    gap: spacingField,
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
    numColumns: 4,
    gap: "4",
    itemStyle: "none",
    itemPadding: undefined,
    items: [],
  },
  render: ({ gap, numColumns, itemStyle, itemPadding, items: Items }) => {
    const hasItemStyle = itemStyle && itemStyle !== "none";

    const itemPaddingStyle = itemPadding
      ? `calc(var(--theme-spacing-unit, 0.25rem) * ${itemPadding})`
      : undefined;

    return (
      <Section>
        <Items
          disallow={["Hero", "Stats"]}
          className={getClassName({
            hasItemStyle,
            [`item-${itemStyle}`]: hasItemStyle,
          })}
          style={{
            gap: `var(--spacing-${gap}, 24px)`,
            gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
            ...(itemPaddingStyle && {
              "--grid-item-padding": itemPaddingStyle,
            }),
          } as React.CSSProperties}
        />
      </Section>
    );
  },
};

export const Grid = withLayout(GridInternal);
