import { ReactNode } from "react";
import styles from "./styles.module.css";
import getClassNameFactory from "../../lib/get-class-name-factory";
import type { TypographySize } from "../../utils/typography";
import { SIZE_MIGRATION_MAP } from "../../utils/typography";

const getClassName = getClassNameFactory("Heading", styles);

// Old size type for backwards compatibility
type LegacySize = "xxxxl" | "xxxl" | "xxl" | "xl" | "l" | "m" | "s" | "xs";

export type HeadingProps = {
  children: ReactNode;
  rank?: "1" | "2" | "3" | "4" | "5" | "6";
  size?: TypographySize | LegacySize;
};

export const Heading = ({ children, rank, size = "base" }: HeadingProps) => {
  const Tag: any = rank ? `h${rank}` : "span";

  // Migrate old size values to new semantic sizes
  const normalizedSize = size && size.toUpperCase() in SIZE_MIGRATION_MAP
    ? SIZE_MIGRATION_MAP[size.toUpperCase()]
    : size;

  return (
    <Tag
      className={getClassName({
        [normalizedSize]: true,
      })}
    >
      {children}
    </Tag>
  );
};
