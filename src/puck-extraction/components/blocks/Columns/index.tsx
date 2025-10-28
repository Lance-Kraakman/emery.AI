import React from "react";
import { ComponentConfig, DropZone } from "@measured/puck";
import styles from "./styles.module.css";
import { Section } from "../../shared/Section";

// Generate cryptographically secure random ID
const generateId = () =>
  "_" + crypto.randomUUID().replace(/-/g, "").slice(0, 9);

export type ColumnsProps = {
  distribution: "auto" | "manual";
  columns: {
    span?: number;
    id?: string;
  }[];
};

export const Columns: ComponentConfig<ColumnsProps> = {
  // Dynamically generate an ID for each column
  resolveData: ({ props }, { lastData }) => {
    if (lastData?.props.columns.length === props.columns.length) {
      return { props };
    }
    return {
      props: {
        ...props,
        columns: props.columns.map((column) => ({
          ...column,
          id: column.id ?? generateId(),
        })),
      },
    };
  },
  fields: {
    distribution: {
      type: "radio",
      options: [
        {
          value: "auto",
          label: "Auto",
        },
        {
          value: "manual",
          label: "Manual",
        },
      ],
    },
    columns: {
      type: "array",
      getItemSummary: (col) =>
        `Column (span ${
          col.span ? Math.max(Math.min(col.span, 12), 1) : "auto"
        })`,
      arrayFields: {
        span: {
          label: "Span (1-12)",
          type: "number",
          min: 0,
          max: 12,
        },
      },
    },
  },
  defaultProps: {
    distribution: "auto",
    columns: [{}, {}],
  },
  render: ({ columns, distribution }) => {
    return (
      <Section>
        <div
          className={styles.columnsContainer}
          style={{
            display: "grid",
            gridTemplateColumns:
              distribution === "manual"
                ? columns.map((col) => `span ${col.span || 1}`).join(" ")
                : `repeat(${columns.length}, 1fr)`,
          }}
        >
          {columns.map(({ span, id }, idx) => (
            <div
              key={id ?? idx}
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                overflowX: "hidden",
                overflowY: "auto",
                gridColumn:
                  span && distribution === "manual"
                    ? `span ${Math.max(Math.min(span, 12), 1)}`
                    : "",
              }}
            >
              <DropZone
                zone={`column-${id ?? idx}`}
                disallow={["Hero", "Logos", "Stats"]}
              />
            </div>
          ))}
        </div>
      </Section>
    );
  },
};
