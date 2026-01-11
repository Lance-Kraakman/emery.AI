import { Button } from "./blocks/Button";
import { Card } from "./blocks/Card";
import { Container } from "./blocks/Container";
import { Divider } from "./blocks/Divider";
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
import { LinkBlockConfig } from "./blocks/LinkBlock";
import { DataBlockConfig } from "./blocks/DataBlock";
import { ConditionalBlock } from "./blocks/ConditionalBlock";
import { DialogBlock } from "./blocks/DialogBlock";
import TextFieldConfig from "./blocks/TextField";
import ImageFieldConfig from "./blocks/ImageField";
import DateFieldConfig from "./blocks/DateField";
import SelectFieldConfig from "./blocks/SelectField";
import NumberFieldConfig from "./blocks/NumberField";
import BooleanFieldConfig from "./blocks/BooleanField";
import RelationFieldConfig from "./blocks/RelationField";
import FileFieldConfig from "./blocks/FileField";
import DocumentFieldConfig from "./blocks/DocumentField";
import LinkFieldConfig from "./blocks/LinkField";
import { EditorBlock } from "./blocks/EditorBlock";
import { MarkdownBlock } from "./blocks/MarkdownBlock";

import Root from "./root";
import { UserConfig } from "./types";
import { FIELD_BLOCK_TYPES } from "./constants";

export const config: UserConfig = {
  root: Root,
  categories: {
    layout: {
      // HeaderBlock and FooterBlock removed - now available as system templates
      components: ["Grid", "Flex", "Container", "Space", "Divider"],
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
      components: ["DataBlock", "TableBlock", "MetricBlock", "ChartBlock", "FormBlock"],
    },
    logic: {
      title: "Logic",
      components: ["ConditionalBlock", "DialogBlock"],
    },
    content: {
      title: "Content",
      components: ["EditorBlock", "MarkdownBlock"],
    },
    fields: {
      title: "Fields",
      components: [...FIELD_BLOCK_TYPES],
    },
    other: {
      title: "Other",
      // Hero, Card, Logos, Stats removed - now available as system templates
      components: ["Template"],
    },
  },
  components: {
    Button,
    Card,
    Container,
    Divider,
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
    DataBlock: DataBlockConfig,
    ConditionalBlock,
    DialogBlock,
    TableBlock: TableBlockConfig,
    MetricBlock: MetricBlockConfig,
    ChartBlock: ChartBlockConfig,
    FormBlock: FormBlockConfig,
    LinkBlock: LinkBlockConfig,
    TextField: TextFieldConfig,
    NumberField: NumberFieldConfig,
    BooleanField: BooleanFieldConfig,
    DateField: DateFieldConfig,
    SelectField: SelectFieldConfig,
    ImageField: ImageFieldConfig,
    FileField: FileFieldConfig,
    DocumentField: DocumentFieldConfig,
    RelationField: RelationFieldConfig,
    LinkField: LinkFieldConfig,
    LoginBlock,
    SignOutBlock,
    EditorBlock,
    MarkdownBlock,
  },
};

export default config;
