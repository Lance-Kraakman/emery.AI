import { ComponentConfig, Slot } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("FooterBlock", styles);

export type FooterBlockProps = {
  layout?: "columns" | "centered" | "minimal";
  numColumns?: 2 | 3 | 4;
  columns?: Slot;
  bottomBar?: Slot;
  backgroundColor?: string;
};

export const FooterBlock: ComponentConfig<FooterBlockProps> = {
  label: "Footer",
  fields: {
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Columns", value: "columns" },
        { label: "Centered", value: "centered" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    numColumns: {
      type: "radio",
      label: "Number of Columns",
      options: [
        { label: "2", value: 2 },
        { label: "3", value: 3 },
        { label: "4", value: 4 },
      ],
    },
    columns: {
      type: "slot",
      label: "Content",
    },
    bottomBar: {
      type: "slot",
      label: "Bottom Bar",
    },
    backgroundColor: {
      type: "select",
      label: "Background Color",
      options: [
        { label: "Light Gray", value: "#f9fafb" },
        { label: "Dark Gray", value: "#1f2937" },
        { label: "Black", value: "#111827" },
      ],
    },
  },
  defaultProps: {
    layout: "columns",
    numColumns: 4,
    columns: [],
    bottomBar: [],
    backgroundColor: "#1f2937",
  },
  resolveFields: async (data, { fields }) => {
    const layout = data.props.layout || "columns";

    // Only show numColumns for column layout
    if (layout !== "columns") {
      return {
        ...fields,
        numColumns: undefined,
      };
    }

    return fields;
  },
  render: ({ layout, numColumns, columns: Columns, bottomBar: BottomBar, backgroundColor, puck }) => {
    const isDark = backgroundColor !== "#f9fafb";

    return (
      <footer
        className={getClassName({
          [layout || "columns"]: true,
        })}
        style={{
          backgroundColor,
          color: isDark ? "white" : "inherit",
        }}
      >
        <div className={getClassName("inner")}>
          {Columns && (
            <div
              className={getClassName("columns")}
              style={{
                gridTemplateColumns:
                  layout === "columns"
                    ? `repeat(${numColumns || 4}, 1fr)`
                    : undefined,
              }}
            >
              <Columns />
            </div>
          )}

          {BottomBar && (
            <div className={getClassName("bottomBar")}>
              <BottomBar />
            </div>
          )}
        </div>
      </footer>
    );
  },
};
