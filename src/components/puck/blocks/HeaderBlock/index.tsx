import { ComponentConfig, Slot } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import { createComponent } from "@/components/puck/lib/create-component";
import { ColorFieldRenderer } from "@/components/puck/fields/ColorField";
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
      type: "custom",
      label: "Background Color (Optional)",
      render: ColorFieldRenderer,
    },
  },
  defaultProps: {
    layout: "left-nav",
    logo: [],
    navigation: [],
    actions: [],
    sticky: true,
    backgroundColor: undefined,
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
  resolveData: async (data, { changed, trigger }) => {
    // Only populate when component is first inserted (dragged onto page)
    if (trigger !== "insert") return data;

    // Pre-populate slots with default content
    const logo = [
      await createComponent("Heading", {
        text: "LOGO",
        size: "xl",
      }),
    ];

    const navigation = [
      await createComponent("Button", {
        label: "Home",
        action: { actionType: "url", url: "/" },
        variant: "secondary",
      }),
      await createComponent("Button", {
        label: "About",
        action: { actionType: "url", url: "/about" },
        variant: "secondary",
      }),
      await createComponent("Button", {
        label: "Contact",
        action: { actionType: "url", url: "/contact" },
        variant: "secondary",
      }),
    ];

    const actions = [
      await createComponent("Button", {
        label: "Get Started",
        action: { actionType: "none" },
        variant: "primary",
      }),
    ];

    return {
      ...data,
      props: {
        ...data.props,
        logo,
        navigation,
        actions,
      },
    };
  },
  render: ({ layout, logo: Logo, navigation: Navigation, actions: Actions, sticky, backgroundColor, puck }) => {
    return (
      <header
        className={getClassName({
          sticky: sticky,
          [layout || "left-nav"]: true,
        })}
        style={{
          ...(backgroundColor && { backgroundColor }),
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
