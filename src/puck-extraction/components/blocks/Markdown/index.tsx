import { ComponentConfig } from "@measured/puck";
import ReactMarkdown from "react-markdown";

export type MarkdownCardProps = {
  asset?: string | null | undefined;
  size?: "sm" | "base" | "lg" | "xl";
  align?: "left" | "center" | "right";
  padding?: string;
  maxWidth?: string;
  weight?: "normal" | "medium" | "semibold" | "bold";
};

const getFontWeight = (weight?: string) => {
  switch (weight) {
    case "medium":
      return 500;
    case "semibold":
      return 600;
    case "bold":
      return 700;
    default:
      return 400;
  }
};

export const MarkdownCard: ComponentConfig<MarkdownCardProps> = {
  fields: {
    asset: {
      type: "textarea",
      label: "Markdown Content",
    },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Base", value: "base" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    weight: {
      type: "select",
      label: "Weight",
      options: [
        { label: "Normal", value: "normal" },
        { label: "Medium", value: "medium" },
        { label: "Semibold", value: "semibold" },
        { label: "Bold", value: "bold" },
      ],
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    padding: { type: "text" },
    maxWidth: { type: "text" },
  },
  defaultProps: {
    size: "base",
    align: "left",
    padding: "0px",
    maxWidth: "100%",
    weight: "normal",
  },
  render: ({ asset, size, align, padding, maxWidth, weight }) => {
    return (
      <MarkdownCardModal
        asset={asset ?? ""}
        size={size}
        align={align}
        padding={padding}
        maxWidth={maxWidth}
        weight={weight}
      />
    );
  },
};

export const MarkdownCardModal = ({
  asset,
  size,
  align,
  padding,
  maxWidth,
  weight,
}: {
  asset: string;
  size?: string;
  align?: string;
  padding?: string;
  maxWidth?: string;
  weight?: string;
}) => {
  const sizeClass = {
    sm: "prose-sm",
    base: "prose",
    lg: "prose-lg",
    xl: "prose-xl",
  }[size || "base"];

  return (
    <section
      className={`${sizeClass} mx-auto p-6`}
      style={{
        padding,
        maxWidth,
        textAlign: (align as "left" | "center" | "right") || "left",
        fontWeight: getFontWeight(weight),
      }}
    >
      <ReactMarkdown>{asset}</ReactMarkdown>
    </section>
  );
};
