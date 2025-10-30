import { Config, Data } from "@measured/puck";
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
import { HeaderBlockProps } from "./blocks/HeaderBlock";
import { FooterBlockProps } from "./blocks/FooterBlock";

import { RootProps } from "./root";

export type { RootProps } from "./root";

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
