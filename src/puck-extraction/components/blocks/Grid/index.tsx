import React from "react";
import { ComponentConfig } from "@measured/puck";
import { DropZone } from "@measured/puck";

export type GridProps = {
  rows: number;
  columns: number;
  gap?: string;
};

export const Grid: ComponentConfig<GridProps> = {
  fields: {
    rows: { type: "number", label: "Rows" },
    columns: { type: "number", label: "Columns" },
    gap: { type: "text", label: "Gap" },
  },
  defaultProps: {
    rows: 2,
    columns: 2,
    gap: "8px",
  },
  render: (props) => {
    const { rows, columns, gap } = props;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        cells.push(
          <div key={`${r}-${c}`} style={{ width: "100%", height: "100%" }}>
            <DropZone zone={`cell-${r}-${c}`} />
          </div>,
        );
      }
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap,
          width: "100%",
          height: "100%",
        }}
      >
        {cells}
      </div>
    );
  },
};
