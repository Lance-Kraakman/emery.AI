import { Config, Data, Slot } from "@measured/puck";

/**
 * Page Variable - defines expected query parameters for a page
 * These are shown in the variable autocomplete and used for navigation actions
 */
export interface PageVariable {
  name: string;           // e.g., "user_id", "product_id"
  type: 'string' | 'number';
  required: boolean;
  description?: string;
}

// Re-export PageStateConfig for use in DB schema
export type { PageStateConfig } from './types/state';
import { ButtonProps } from "./blocks/Button";
import { CardProps } from "./blocks/Card";
import { ContainerProps } from "./blocks/Container";
import { DividerProps } from "./blocks/Divider";
import { GridProps } from "./blocks/Grid";
import { HeroProps } from "./blocks/Hero";
import { HeadingProps } from "./blocks/Heading";
import { FlexProps } from "./blocks/Flex";
import { LogosProps } from "./blocks/Logos";
import { StatsProps } from "./blocks/Stats";
import { TemplateProps } from "./blocks/Template";
import { TextProps } from "./blocks/Text";
import { SpaceProps } from "./blocks/Space";
import { TableBlockProps } from "./blocks/TableBlock/TableBlock";
import { MetricBlockProps } from "./blocks/MetricBlock/MetricBlock";
import { ChartBlockProps } from "./blocks/ChartBlock/ChartBlock";
import { FormBlockProps } from "./blocks/FormBlock/FormBlock";
import { DataBlockProps } from "./blocks/DataBlock/DataBlock";
import { LinkBlockProps } from "./blocks/LinkBlock/LinkBlock";
import { TextFieldProps } from "./blocks/TextField/TextField";
import { NumberFieldProps } from "./blocks/NumberField/NumberField";
import { BooleanFieldProps } from "./blocks/BooleanField/BooleanField";
import { ImageFieldProps } from "./blocks/ImageField/ImageField";
import { DateFieldProps } from "./blocks/DateField/DateField";
import { SelectFieldProps } from "./blocks/SelectField/SelectField";
import { FileFieldProps } from "./blocks/FileField/types";
import { DocumentFieldProps } from "./blocks/DocumentField/types";
import { RelationFieldProps } from "./blocks/RelationField/RelationField";
import { LinkFieldProps } from "./blocks/LinkField/LinkField";
import type { LoginBlockProps } from "./blocks/LoginBlock";
import type { SignOutBlockProps } from "./blocks/SignOutBlock";
import type { EditorBlockProps } from "./blocks/EditorBlock/types";
import type { ConditionalBlockProps } from "./blocks/ConditionalBlock";
import type { DialogBlockProps } from "./blocks/DialogBlock";

import { RootProps } from "./root";

export type { RootProps } from "./root";

// Updated HeaderBlock and FooterBlock types with slots
export type HeaderBlockProps = {
  layout?: "left-nav" | "centered" | "split" | "minimal";
  logo?: Slot;
  navigation?: Slot;
  actions?: Slot;
  sticky?: boolean;
  backgroundColor?: string;
};

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

export type Components = {
  Button: ButtonProps;
  Card: CardProps;
  Container: ContainerProps;
  Divider: DividerProps;
  Grid: GridProps;
  Hero: HeroProps;
  Heading: HeadingProps;
  Flex: FlexProps;
  Logos: LogosProps;
  Stats: StatsProps;
  Template: TemplateProps;
  Text: TextProps;
  Space: SpaceProps;
  HeaderBlock: HeaderBlockProps;
  FooterBlock: FooterBlockProps;
  DataBlock: DataBlockProps;
  ConditionalBlock: ConditionalBlockProps;
  DialogBlock: DialogBlockProps;
  TableBlock: TableBlockProps;
  MetricBlock: MetricBlockProps;
  ChartBlock: ChartBlockProps;
  FormBlock: FormBlockProps;
  LinkBlock: LinkBlockProps;
  TextField: TextFieldProps;
  NumberField: NumberFieldProps;
  BooleanField: BooleanFieldProps;
  ImageField: ImageFieldProps;
  DateField: DateFieldProps;
  SelectField: SelectFieldProps;
  FileField: FileFieldProps;
  DocumentField: DocumentFieldProps;
  RelationField: RelationFieldProps;
  LinkField: LinkFieldProps;
  LoginBlock: LoginBlockProps;
  SignOutBlock: SignOutBlockProps;
  EditorBlock: EditorBlockProps;
};

export type UserConfig = Config<{
  components: Components;
  root: RootProps;
}>;

export type UserData = Data<Components, RootProps>;
