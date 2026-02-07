import { CSSProperties, forwardRef, ReactNode } from "react";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";

const getClassName = getClassNameFactory("Section", styles);

export type SectionProps = {
  className?: string;
  children: ReactNode;
  maxWidth?: string;
  style?: CSSProperties;
  raw?: boolean;
};

export const Section = forwardRef<HTMLDivElement, SectionProps>(
  function Section({ children, className, maxWidth = "1280px", style = {}, raw = false }, ref) {
    if (raw) {
      return (
        <div
          className={`${getClassName()}${getClassName("raw")}${className ? ` ${className}` : ""}`}
          style={{
            ...style,
          }}
          ref={ref}
        >
          {children}
        </div>
      );
    }

    return (
      <div
        className={`${getClassName()}${className ? ` ${className}` : ""}`}
        style={{
          ...style,
        }}
        ref={ref}
      >
        <div className={getClassName("inner")} style={{ maxWidth }}>
          {children}
        </div>
      </div>
    );
  }
);
