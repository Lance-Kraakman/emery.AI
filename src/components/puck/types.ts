import { Config, Data, Slot } from "@measured/puck";
import { ButtonProps } from "./blocks/Button";
import { CardProps } from "./blocks/Card";
import { GridProps } from "./blocks/Grid";
import { HeroProps } from "./blocks/Hero";
import { HeadingProps } from "./blocks/Heading";
import { FlexProps } from "./blocks/Flex";
import { LogosProps } from "./blocks/Logos";
import { StatsProps } from "./blocks/Stats";
import { TemplateProps } from "./blocks/Template";
import { TextProps } from "./blocks/Text";
import { SpaceProps } from "./blocks/Space";

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
};

export type UserConfig = Config<{
  components: Components;
  root: RootProps;
}>;

export type UserData = Data<Components, RootProps>;
