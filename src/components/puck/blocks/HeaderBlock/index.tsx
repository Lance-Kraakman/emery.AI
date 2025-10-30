import { ComponentConfig } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("HeaderBlock", styles);

export type HeaderBlockProps = {
  logo?: string;
  navItems?: Array<{ label: string; href: string }>;
  sticky?: boolean;
  backgroundColor?: string;
};

export const HeaderBlock: ComponentConfig<HeaderBlockProps> = {
  label: "Header",
  fields: {
    logo: {
      type: "text",
      label: "Logo Text",
    },
    navItems: {
      type: "array",
      label: "Navigation Items",
      getItemSummary: (item) => item.label || "Nav Item",
      arrayFields: {
        label: { type: "text" },
        href: { type: "text" },
      },
      defaultItemProps: {
        label: "Link",
        href: "#",
      },
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
    logo: "LOGO",
    navItems: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    sticky: true,
    backgroundColor: "white",
  },
  render: ({ logo, navItems, sticky, backgroundColor, puck }) => {
    return (
      <header
        className={getClassName({ sticky: sticky })}
        style={{
          backgroundColor,
          color: backgroundColor === "#1f2937" ? "white" : "inherit",
        }}
      >
        <div className={getClassName("inner")}>
          <div className={getClassName("logo")}>{logo}</div>
          <nav className={getClassName("nav")}>
            {navItems?.map((item, idx) => (
              <a
                key={idx}
                href={puck.isEditing ? "#" : item.href}
                className={getClassName("navLink")}
                style={{
                  color: backgroundColor === "#1f2937" ? "white" : "inherit",
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
    );
  },
};
