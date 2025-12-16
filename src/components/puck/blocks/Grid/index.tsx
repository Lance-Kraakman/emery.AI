import React from "react";
import { ComponentConfig, Slot } from "@measured/puck";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Section } from "../../components/Section";
import { withLayout } from "../../components/Layout";
import { spacingField, paddingField } from "../../fields/standard-fields";
import type { FourSidedSpacing } from "../../types/spacing-types";
import { useTheme } from "../../theme-context";
import { computeFourSidedShorthand } from "../../utils/spacing";

const getClassName = getClassNameFactory("Grid", styles);

export type ItemStyle = "none" | "card" | "bordered" | "subtle";

export type GridProps = {
  numColumns: number;
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
  render: function GridRender({ gap, numColumns, itemStyle, itemPadding, items: Items }) {
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
