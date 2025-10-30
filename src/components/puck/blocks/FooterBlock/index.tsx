import { ComponentConfig } from "@measured/puck";
import { getClassNameFactory } from "@/components/puck/lib";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("FooterBlock", styles);

export type FooterBlockProps = {
  columns?: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
  copyrightText?: string;
  backgroundColor?: string;
};

export const FooterBlock: ComponentConfig<FooterBlockProps> = {
  label: "Footer",
  fields: {
    columns: {
      type: "array",
      label: "Footer Columns",
      getItemSummary: (item) => item.title || "Column",
      arrayFields: {
        title: { type: "text" },
        links: {
          type: "array",
          arrayFields: {
            label: { type: "text" },
            href: { type: "text" },
          },
        },
      },
      defaultItemProps: {
        title: "Section",
        links: [
          { label: "Link 1", href: "#" },
          { label: "Link 2", href: "#" },
        ],
      },
    },
    copyrightText: {
      type: "text",
      label: "Copyright Text",
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
    columns: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#" },
          { label: "Pricing", href: "#" },
          { label: "FAQ", href: "#" },
        ],
      },
      {
        title: "Company",
        links: [
          { label: "About", href: "#" },
          { label: "Blog", href: "#" },
          { label: "Careers", href: "#" },
        ],
      },
      {
        title: "Support",
        links: [
          { label: "Help Center", href: "#" },
          { label: "Contact", href: "#" },
          { label: "Status", href: "#" },
        ],
      },
    ],
    copyrightText: "© 2025 Your Company. All rights reserved.",
    backgroundColor: "#1f2937",
  },
  render: ({ columns, copyrightText, backgroundColor, puck }) => {
    const isDark = backgroundColor !== "#f9fafb";

    return (
      <footer
        className={getClassName()}
        style={{
          backgroundColor,
          color: isDark ? "white" : "inherit",
        }}
      >
        <div className={getClassName("inner")}>
          <div className={getClassName("columns")}>
            {columns?.map((column, idx) => (
              <div key={idx} className={getClassName("column")}>
                <h3
                  className={getClassName("columnTitle")}
                  style={{ color: isDark ? "#e5e7eb" : "#374151" }}
                >
                  {column.title}
                </h3>
                <ul className={getClassName("linkList")}>
                  {column.links?.map((link, linkIdx) => (
                    <li key={linkIdx}>
                      <a
                        href={puck.isEditing ? "#" : link.href}
                        className={getClassName("link")}
                        style={{
                          color: isDark ? "#9ca3af" : "#6b7280",
                        }}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {copyrightText && (
            <div
              className={getClassName("copyright")}
              style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
            >
              {copyrightText}
            </div>
          )}
        </div>
      </footer>
    );
  },
};
