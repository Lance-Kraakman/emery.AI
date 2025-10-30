import { ComponentConfig, Slot } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("HeaderBlock", styles);

export type HeaderBlockProps = {
  layout?: "left-nav" | "centered" | "split" | "minimal";
  logo?: Slot;
  navigation?: Slot;
  actions?: Slot;
  sticky?: boolean;
  backgroundColor?: string;
};

export const HeaderBlock: ComponentConfig<HeaderBlockProps> = {
  label: "Header",
  fields: {
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Left Logo + Nav", value: "left-nav" },
        { label: "Centered", value: "centered" },
        { label: "Split", value: "split" },
        { label: "Minimal", value: "minimal" },
      ],
    },
    logo: {
      type: "slot",
      label: "Logo",
    },
    navigation: {
      type: "slot",
      label: "Navigation",
    },
    actions: {
      type: "slot",
      label: "Actions",
    },
    sticky: {
      type: "radio",
      label: "Sticky Header",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    backgroundColor: {
      type: "select",
      label: "Background Color",
      options: [
        { label: "White", value: "white" },
        { label: "Light Gray", value: "#f9fafb" },
        { label: "Dark", value: "#1f2937" },
      ],
    },
  },
  defaultProps: {
    layout: "left-nav",
    logo: [],
    navigation: [],
    actions: [],
    sticky: true,
    backgroundColor: "white",
  },
  resolveFields: async (data, { fields }) => {
    const layout = data.props.layout || "left-nav";

    // Hide fields based on layout
    if (layout === "minimal") {
      return {
        ...fields,
        navigation: undefined, // Hide navigation in minimal layout
      };
    }

    if (layout === "centered") {
      return {
        ...fields,
        actions: undefined, // Hide actions in centered layout
      };
    }

    return fields;
  },
  render: ({ layout, logo: Logo, navigation: Navigation, actions: Actions, sticky, backgroundColor, puck }) => {
    const isDark = backgroundColor === "#1f2937";

    return (
      <header
        className={getClassName({
          sticky: sticky,
          [layout || "left-nav"]: true,
        })}
        style={{
          backgroundColor,
          color: isDark ? "white" : "inherit",
        }}
      >
        <div className={getClassName("inner")}>
          {Logo && (
            <div className={getClassName("logoSlot")}>
              <Logo />
            </div>
          )}

          {Navigation && layout !== "minimal" && (
            <div className={getClassName("navigationSlot")}>
              <Navigation />
            </div>
          )}

          {Actions && layout !== "centered" && (
            <div className={getClassName("actionsSlot")}>
              <Actions />
            </div>
          )}
        </div>
      </header>
    );
  },
};
