/* eslint-disable @next/next/no-img-element */
import React, { ReactNode } from "react";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Button } from "@/components/puck/components/Button";
import { Section } from "../../components/Section";
import { PuckComponent, Slot } from "@measured/puck";

const getClassName = getClassNameFactory("Hero", styles);

export type HeroProps = {
  quote?: { index: number; label: string };
  title: string | ReactNode;
  description: string;
  align?: string;
  padding?: string;
  image?: {
    content?: Slot;
    mode?: "inline" | "background" | "custom";
    url?: string;
  };
  buttons: {
    label: string;
    href: string;
    variant?: "primary" | "secondary";
  }[];
  titleColor?: string;
  subtitleColor?: string;
  backgroundColor?: string;
  titleFontFamily?: string;
  titleFontWeight?: string;
  subtitleFontFamily?: string;
  subtitleFontWeight?: string;
};

export const Hero: PuckComponent<HeroProps> = ({
  align,
  title,
  description,
  buttons,
  padding = "48px",
  image,
  titleColor,
  subtitleColor,
  backgroundColor,
  titleFontFamily,
  titleFontWeight,
  subtitleFontFamily,
  subtitleFontWeight,
  puck,
}) => {
  return (
    <Section
      className={getClassName({
        left: align === "left",
        center: align === "center",
        hasImageBackground: image?.mode === "background",
      })}
      style={{
        paddingTop: padding,
        paddingBottom: padding,
        ...(backgroundColor && { backgroundColor }),
      }}
    >
      {image?.mode === "background" && (
        <>
          <div
            className={getClassName("image")}
            style={{
              backgroundImage: `url("${image?.url}")`,
            }}
          ></div>

          <div className={getClassName("imageOverlay")}></div>
        </>
      )}

      <div className={getClassName("inner")}>
        <div className={getClassName("content")}>
          <h1
            style={{
              ...(titleColor && { color: titleColor }),
              ...(titleFontFamily && { fontFamily: titleFontFamily }),
              ...(titleFontWeight && { fontWeight: titleFontWeight }),
            }}
          >
            {title}
          </h1>
          <p
            className={getClassName("subtitle")}
            style={{
              ...(subtitleColor && { color: subtitleColor }),
              ...(subtitleFontFamily && { fontFamily: subtitleFontFamily }),
              ...(subtitleFontWeight && { fontWeight: subtitleFontWeight }),
            }}
          >
            {description}
          </p>
          <div className={getClassName("actions")}>
            {buttons.map((button, i) => (
              <Button
                key={i}
                href={button.href}
                variant={button.variant}
                size="large"
                tabIndex={puck.isEditing ? -1 : undefined}
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>

        {align !== "center" && image?.mode === "inline" && image?.url && (
          <div
            style={{
              backgroundImage: `url('${image?.url}')`,
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              borderRadius: 24,
              height: 356,
              marginLeft: "auto",
              width: "100%",
            }}
          />
        )}

        {align !== "center" && image?.mode === "custom" && image.content && (
          <image.content
            style={{
              height: 356,
              marginLeft: "auto",
              width: "100%",
            }}
          />
        )}
      </div>
    </Section>
  );
};

export default Hero;
