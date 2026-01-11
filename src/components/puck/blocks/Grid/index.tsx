import React from "react";
import { ComponentConfig, Slot } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { withLayout } from "../../components/Layout";
import { spacingField, paddingField, justifyItemsField, alignItemsField } from "../../fields/standard-fields";
import type { FourSidedSpacing } from "../../types/spacing-types";
import { useTheme } from "../../contexts/PageContext";
import { computeFourSidedShorthand } from "../../utils/spacing";

const getClassName = getClassNameFactory("Grid", styles);

export type ItemStyle = "none" | "card" | "bordered" | "subtle";

export type GridProps = {
  numColumns: number;
  justifyItems: "start" | "center" | "end" | "stretch";
  alignItems: "start" | "center" | "end" | "stretch";
  gap: string;
  itemStyle?: ItemStyle;
  itemPadding?: FourSidedSpacing;
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
    justifyItems: justifyItemsField,
    alignItems: alignItemsField,
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
    justifyItems: "start",
    alignItems: "start",
    gap: "4",
    itemStyle: "none",
    itemPadding: undefined,
    items: [],
  },
  render: function GridRender({ gap, numColumns, justifyItems, alignItems, itemStyle, itemPadding, items: Items }) {
    const theme = useTheme();
    const hasItemStyle = itemStyle && itemStyle !== "none";

    // Compute item padding as shorthand CSS value
    const itemPaddingStyle = itemPadding
      ? computeFourSidedShorthand(itemPadding, theme)
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
            justifyItems,
            alignItems,
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
