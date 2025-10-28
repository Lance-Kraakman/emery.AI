import { CSSProperties, ReactNode } from "react";
import styles from "./styles.module.css";

export type SectionProps = {
  className?: string;
  children: ReactNode;
  padding?: string;
  maxWidth?: string;
  style?: CSSProperties;
};

export const Section = ({
  children,
  className,
  padding = "0px",
  maxWidth = "1280px",
  style = {},
}: SectionProps) => {
  return (
    <div
      className={`${styles.section} ${className || ""}`}
      style={{
        ...style,
        paddingTop: padding,
        paddingBottom: padding,
      }}
    >
      <div className={styles.sectionInner} style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
};
