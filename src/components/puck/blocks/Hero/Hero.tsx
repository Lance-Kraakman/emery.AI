/* eslint-disable @next/next/no-img-element */
import React from "react";
import styles from "./styles.module.css";
import { getClassNameFactory } from "@/components/puck/lib";
import { Button } from "@/components/puck/components/Button";
import { Section } from "../../components/Section";
import { PuckComponent, Slot } from "@measured/puck";
import type { LinkActionConfig } from "../../custom-fields/link-action-field";
import type { Action } from "../../types/actions";
import type { FourSidedSpacing } from "../../types/spacing-types";
import { useTheme } from "../../contexts/PageContext";
import { computeFourSidedCSS } from "../../utils/spacing";
import { useInterpolatedText } from "../../hooks/useInterpolatedText";

const getClassName = getClassNameFactory("Hero", styles);

// Convert legacy LinkActionConfig to new Action array format
function convertLegacyAction(action: LinkActionConfig): Action[] {
  if (!action || action.actionType === 'none') {
    return [];
  }

  switch (action.actionType) {
    case 'page':
      return action.pageId
        ? [{ type: 'navigateToPage', pageId: action.pageId.toString() }]
        : [];
    case 'url':
      return action.url
        ? [{ type: 'openUrl', url: action.url, newTab: action.openInNewTab || false }]
        : [];
    default:
      return [];
  }
}

export type HeroProps = {
  quote?: { index: number; label: string };
  title: string;
  description: string;
  align?: string;
  padding?: FourSidedSpacing;
  image?: {
    content?: Slot;
    mode?: "inline" | "background" | "custom";
    url?: string;
  };
  buttons: {
    label: string;
    action: LinkActionConfig;
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
  padding,
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
  const theme = useTheme();
  const paddingStyles = padding ? computeFourSidedCSS(padding, theme, 'padding') : { paddingTop: '48px', paddingBottom: '48px' };
  // Interpolate variables in title and description
  const interpolatedTitle = useInterpolatedText(title);
  const interpolatedDescription = useInterpolatedText(description);

  return (
    <Section
      className={getClassName({
        left: align === "left",
        center: align === "center",
        hasImageBackground: image?.mode === "background",
      })}
      style={{
        ...paddingStyles,
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
            {interpolatedTitle}
          </h1>
          <p
            className={getClassName("subtitle")}
            style={{
              ...(subtitleColor && { color: subtitleColor }),
              ...(subtitleFontFamily && { fontFamily: subtitleFontFamily }),
              ...(subtitleFontWeight && { fontWeight: subtitleFontWeight }),
            }}
          >
            {interpolatedDescription}
          </p>
          <div className={getClassName("actions")}>
            {buttons.map((button, i) => (
              <Button
                key={i}
                actions={convertLegacyAction(button.action)}
                variant={button.variant}
                size="large"
                isEditing={puck.isEditing}
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
              borderRadius: "var(--theme-border-radius, 24px)",
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
