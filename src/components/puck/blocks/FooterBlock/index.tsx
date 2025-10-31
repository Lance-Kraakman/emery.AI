import { ComponentConfig, Slot } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import { createComponent } from "@/components/puck/lib/create-component";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("FooterBlock", styles);

export type FooterBlockProps = {
  layout?: "columns" | "centered" | "minimal";
  numColumns?: 2 | 3 | 4;
  column1?: Slot;
  column2?: Slot;
  column3?: Slot;
  column4?: Slot;
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
    column1: {
      type: "slot",
      label: "Column 1",
    },
    column2: {
      type: "slot",
      label: "Column 2",
    },
    column3: {
      type: "slot",
      label: "Column 3",
    },
    column4: {
      type: "slot",
      label: "Column 4",
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
    column1: [],
    column2: [],
    column3: [],
    column4: [],
    bottomBar: [],
    backgroundColor: "#1f2937",
  },
  resolveFields: async (data, { fields }) => {
    const layout = data.props.layout || "columns";
    const numColumns = data.props.numColumns || 4;

    // Show/hide fields based on layout and numColumns
    if (layout !== "columns") {
      return {
        ...fields,
        numColumns: undefined,
        column1: undefined,
        column2: undefined,
        column3: undefined,
        column4: undefined,
      };
    }

    // For columns layout, show only the needed columns
    if (numColumns === 2) {
      return {
        ...fields,
        column3: undefined,
        column4: undefined,
      };
    }

    if (numColumns === 3) {
      return {
        ...fields,
        column4: undefined,
      };
    }

    return fields;
  },
  resolveData: async (data, { changed, trigger }) => {
    // Only populate when component is first inserted (dragged onto page)
    if (trigger !== "insert") return data;

    // Pre-populate columns with default content
    const column1 = [
      await createComponent("Heading", {
        text: "Product",
        size: "m",
      }),
      await createComponent("Text", {
        text: "Features",
      }),
      await createComponent("Text", {
        text: "Pricing",
      }),
      await createComponent("Text", {
        text: "FAQ",
      }),
    ];

    const column2 = [
      await createComponent("Heading", {
        text: "Company",
        size: "m",
      }),
      await createComponent("Text", {
        text: "About",
      }),
      await createComponent("Text", {
        text: "Blog",
      }),
      await createComponent("Text", {
        text: "Careers",
      }),
    ];

    const column3 = [
      await createComponent("Heading", {
        text: "Support",
        size: "m",
      }),
      await createComponent("Text", {
        text: "Help Center",
      }),
      await createComponent("Text", {
        text: "Contact",
      }),
      await createComponent("Text", {
        text: "Status",
      }),
    ];

    const column4 = [
      await createComponent("Heading", {
        text: "Legal",
        size: "m",
      }),
      await createComponent("Text", {
        text: "Privacy",
      }),
      await createComponent("Text", {
        text: "Terms",
      }),
      await createComponent("Text", {
        text: "Cookies",
      }),
    ];

    const bottomBar = [
      await createComponent("Text", {
        text: "© 2025 Your Company. All rights reserved.",
      }),
    ];

    return {
      ...data,
      props: {
        ...data.props,
        column1,
        column2,
        column3,
        column4,
        bottomBar,
      },
    };
  },
  render: ({
    layout,
    numColumns,
    column1: Column1,
    column2: Column2,
    column3: Column3,
    column4: Column4,
    bottomBar: BottomBar,
    backgroundColor,
    puck
  }) => {
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
          {layout === "columns" && (
            <div
              className={getClassName("columns")}
              style={{
                gridTemplateColumns: `repeat(${numColumns || 4}, 1fr)`,
              }}
            >
              {Column1 && (
                <div className={getClassName("column")}>
                  <Column1 />
                </div>
              )}
              {Column2 && (numColumns ?? 4) >= 2 && (
                <div className={getClassName("column")}>
                  <Column2 />
                </div>
              )}
              {Column3 && (numColumns ?? 4) >= 3 && (
                <div className={getClassName("column")}>
                  <Column3 />
                </div>
              )}
              {Column4 && (numColumns ?? 4) >= 4 && (
                <div className={getClassName("column")}>
                  <Column4 />
                </div>
              )}
            </div>
          )}

          {layout === "centered" && Column1 && (
            <div className={getClassName("columns")}>
              <div className={getClassName("centeredContent")}>
                <Column1 />
              </div>
            </div>
          )}

          {layout === "minimal" && Column1 && (
            <div className={getClassName("columns")}>
              <div className={getClassName("minimalContent")}>
                <Column1 />
              </div>
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
