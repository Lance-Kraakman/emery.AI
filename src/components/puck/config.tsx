import { Button } from "./blocks/Button";
import { Card } from "./blocks/Card";
import { Grid } from "./blocks/Grid";
import { Hero } from "./blocks/Hero";
import { Heading } from "./blocks/Heading";
import { Flex } from "./blocks/Flex";
import { Logos } from "./blocks/Logos";
import { Stats } from "./blocks/Stats";
import { Template } from "./blocks/Template";
import { Text } from "./blocks/Text";
import { Space } from "./blocks/Space";
import { HeaderBlock } from "./blocks/HeaderBlock";
import { FooterBlock } from "./blocks/FooterBlock";
import TableBlockConfig from "./blocks/TableBlock";
import MetricBlockConfig from "./blocks/MetricBlock";
import ChartBlockConfig from "./blocks/ChartBlock";
import { FormBlockConfig } from "./blocks/FormBlock";

import Root from "./root";
import { UserConfig } from "./types";

export const config: UserConfig = {
  root: Root,
  categories: {
    layout: {
      components: ["HeaderBlock", "Grid", "Flex", "Space", "FooterBlock"],
    },
    typography: {
      components: ["Heading", "Text"],
    },
    interactive: {
      title: "Actions",
      components: ["Button"],
    },
    data: {
      title: "Data",
      components: ["TableBlock", "MetricBlock", "ChartBlock", "FormBlock"],
    },
    other: {
      title: "Other",
      components: ["Card", "Hero", "Logos", "Stats", "Template"],
    },
  },
  components: {
    Button,
    Card,
    Grid,
    Hero,
    Heading,
    Flex,
    Logos,
    Stats,
    Template,
    Text,
    Space,
    HeaderBlock,
    FooterBlock,
    TableBlock: TableBlockConfig,
    MetricBlock: MetricBlockConfig,
    ChartBlock: ChartBlockConfig,
    FormBlock: FormBlockConfig,
  },
};

export default config;
