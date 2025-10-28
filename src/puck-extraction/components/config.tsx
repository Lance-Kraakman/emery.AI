import type { Config } from "@measured/puck";
import {
  Columns,
  Flex,
  Grid,
  VerticalSpace,
  Heading,
  Text,
  MarkdownCard,
  ImageItem,
  TableCardPuck,
  PuckRichText,
} from "./blocks";

type Props = {
  Columns: { distribution: "auto" | "manual"; columns: { span?: number; id?: string }[] };
  Flex: { items: { minItemWidth?: number }[]; minItemWidth: number };
  Grid: { rows: number; columns: number; gap?: string };
  VerticalSpace: { size: string };
  Heading: {
    text: string;
    type: "title" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    align: "left" | "center" | "right";
    color: "default" | "muted";
    padding?: string;
    maxWidth?: string;
    weight?: "normal" | "medium" | "semibold" | "bold";
  };
  Text: {
    text: string;
    size: "s" | "m" | "l" | "xl" | "xxl";
    align: "left" | "center" | "right";
    color: "default" | "muted";
    padding?: string;
    maxWidth?: string;
    weight?: "normal" | "medium" | "semibold" | "bold";
  };
  Markdown: {
    asset?: string | null | undefined;
    size?: "sm" | "base" | "lg" | "xl";
    align?: "left" | "center" | "right";
    padding?: string;
    maxWidth?: string;
    weight?: "normal" | "medium" | "semibold" | "bold";
  };
  Image: { alt: string; url: string; maxWidth: string };
  Table: { title: string; description: string; iconName: string };
  RichText: { state: any };
};

export type UserConfig = Config<Props>;

export const config: UserConfig = {
  categories: {
    layout: {
      title: "Layout",
      components: ["Columns", "Flex", "Grid", "VerticalSpace"],
    },
    content: {
      title: "Content",
      components: ["Heading", "Text", "Markdown", "Image", "RichText", "Table"],
    },
  },
  components: {
    Columns,
    Flex,
    Grid,
    VerticalSpace,
    Heading,
    Text,
    Markdown: MarkdownCard,
    Image: ImageItem,
    RichText: PuckRichText,
    Table: TableCardPuck,
  },
};
