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
import { LoginBlock } from "./blocks/LoginBlock";
import { SignOutBlock } from "./blocks/SignOutBlock";
import { RepeatBlockConfig } from "./blocks/RepeatBlock";
import { LinkBlockConfig } from "./blocks/LinkBlock";
import DataContextBlockConfig from "./blocks/DataContextBlock";
import TextFieldConfig from "./blocks/TextField";
import ImageFieldConfig from "./blocks/ImageField";
import DateFieldConfig from "./blocks/DateField";
import SelectFieldConfig from "./blocks/SelectField";

import Root from "./root";
import { UserConfig } from "./types";

export const config: UserConfig = {
  root: Root,
  categories: {
    layout: {
      components: ["HeaderBlock", "Grid", "Flex", "Space", "FooterBlock", "DataContextBlock"],
    },
    typography: {
      components: ["Heading", "Text"],
    },
    interactive: {
      title: "Actions",
      components: ["Button", "LinkBlock"],
    },
    authentication: {
      title: "Authentication",
      components: ["LoginBlock", "SignOutBlock"],
    },
    data: {
      title: "Data",
      components: ["TableBlock", "RepeatBlock", "MetricBlock", "ChartBlock", "FormBlock"],
    },
    fields: {
      title: "Fields",
      components: ["TextField", "ImageField", "DateField", "SelectField"],
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
    DataContextBlock: DataContextBlockConfig,
    TableBlock: TableBlockConfig,
    RepeatBlock: RepeatBlockConfig,
    MetricBlock: MetricBlockConfig,
    ChartBlock: ChartBlockConfig,
    FormBlock: FormBlockConfig,
    LinkBlock: LinkBlockConfig,
    TextField: TextFieldConfig,
    ImageField: ImageFieldConfig,
    DateField: DateFieldConfig,
    SelectField: SelectFieldConfig,
    LoginBlock,
    SignOutBlock,
  },
};

export default config;
