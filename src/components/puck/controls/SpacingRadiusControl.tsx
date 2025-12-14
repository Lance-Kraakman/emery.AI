/**
 * SpacingRadiusControl - Figma-style visual control for spacing and radius
 *
 * Supports three modes:
 * - 'padding': 4-sided padding control with visual box
 * - 'margin': 4-sided margin control with visual box
 * - 'radius': 4-corner border radius control
 *
 * Features:
 * - Visual box preview showing the applied values
 * - Per-side/corner independent inputs
 * - Link/unlink toggle to sync all values
 * - Compact mode for tight spaces (theme editor sidebar)
 */

"use client";

import * as React from "react";
import { Link2, Unlink2 } from "lucide-react";
import { SpacingLevelInput } from "./SpacingLevelInput";
import type { FourSidedSpacing, FourCornerRadius } from "../types/spacing-types";
import type { SpacingLevel } from "../utils/spacing";
import styles from "./SpacingRadiusControl.module.css";

// ============================================================================
// Types
// ============================================================================

export interface SpacingControlProps {
  mode: "padding" | "margin";
  value: FourSidedSpacing;
  onChange: (value: FourSidedSpacing) => void;
  disabled?: boolean;
  /** Compact mode shows inline inputs without visual box */
  compact?: boolean;
}

export interface RadiusControlProps {
  mode: "radius";
  value: FourCornerRadius;
  onChange: (value: FourCornerRadius) => void;
  disabled?: boolean;
  /** Compact mode shows inline inputs without visual box */
  compact?: boolean;
}

export type SpacingRadiusControlProps = SpacingControlProps | RadiusControlProps;

// ============================================================================
// Helpers
// ============================================================================

function isRadiusMode(
  props: SpacingRadiusControlProps
): props is RadiusControlProps {
  return props.mode === "radius";
}

// ============================================================================
// Component
// ============================================================================

export function SpacingRadiusControl(props: SpacingRadiusControlProps) {
  const { mode, disabled = false, compact = false } = props;

  if (isRadiusMode(props)) {
    return (
      <RadiusControl
        value={props.value}
        onChange={props.onChange}
        disabled={disabled}
        compact={compact}
      />
    );
  }

  // TypeScript doesn't narrow destructured `mode` after type guard, so cast it
  return (
    <SpacingControl
      mode={mode as "padding" | "margin"}
      value={props.value as FourSidedSpacing}
      onChange={props.onChange as (value: FourSidedSpacing) => void}
      disabled={disabled}
      compact={compact}
    />
  );
}

// ============================================================================
// Spacing Control (Padding/Margin)
// ============================================================================

interface SpacingControlInternalProps {
  mode: "padding" | "margin";
  value: FourSidedSpacing;
  onChange: (value: FourSidedSpacing) => void;
  disabled: boolean;
  compact: boolean;
}

function SpacingControl({
  mode,
  value,
  onChange,
  disabled,
  compact,
}: SpacingControlInternalProps) {
  const handleSideChange = (
    side: "top" | "right" | "bottom" | "left",
    newValue: SpacingLevel
  ) => {
    if (value.linked) {
      // When linked, update all sides
      onChange({
        top: newValue,
        right: newValue,
        bottom: newValue,
        left: newValue,
        linked: true,
      });
    } else {
      // When unlinked, update only the specific side
      onChange({
        ...value,
        [side]: newValue,
      });
    }
  };

  const toggleLinked = () => {
    if (!value.linked) {
      // When linking, sync all to the top value
      onChange({
        top: value.top,
        right: value.top,
        bottom: value.top,
        left: value.top,
        linked: true,
      });
    } else {
      onChange({
        ...value,
        linked: false,
      });
    }
  };

  if (compact) {
    return (
      <div className={`${styles.container} ${styles.compact}`}>
        <div className={styles.inputGroup}>
          <span className={styles.label}>T</span>
          <SpacingLevelInput
            value={value.top}
            onChange={(v) => handleSideChange("top", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>R</span>
          <SpacingLevelInput
            value={value.right}
            onChange={(v) => handleSideChange("right", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>B</span>
          <SpacingLevelInput
            value={value.bottom}
            onChange={(v) => handleSideChange("bottom", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>L</span>
          <SpacingLevelInput
            value={value.left}
            onChange={(v) => handleSideChange("left", v)}
            disabled={disabled}
            compact
          />
        </div>
        <button
          type="button"
          className={`${styles.linkToggle} ${value.linked ? styles.linked : ""}`}
          onClick={toggleLinked}
          disabled={disabled}
          title={value.linked ? "Unlink sides" : "Link all sides"}
        >
          {value.linked ? <Link2 /> : <Unlink2 />}
        </button>
      </div>
    );
  }

  // Visual mode with box preview
  const indicatorScale = 4; // px per spacing level for visual indicator

  return (
    <div className={styles.container}>
      <div className={styles.visualContainer}>
        {/* Top input */}
        <div className={styles.topRow}>
          <SpacingLevelInput
            value={value.top}
            onChange={(v) => handleSideChange("top", v)}
            disabled={disabled}
            compact
          />
        </div>

        {/* Middle row: left, visual box, right */}
        <div className={styles.middleRow}>
          <SpacingLevelInput
            value={value.left}
            onChange={(v) => handleSideChange("left", v)}
            disabled={disabled}
            compact
          />

          <div
            className={`${styles.visualBox} ${mode === "padding" ? styles.padding : ""}`}
            style={{
              "--indicator-top": `${Math.min(value.top * indicatorScale, 24)}px`,
              "--indicator-right": `${Math.min(value.right * indicatorScale, 24)}px`,
              "--indicator-bottom": `${Math.min(value.bottom * indicatorScale, 24)}px`,
              "--indicator-left": `${Math.min(value.left * indicatorScale, 24)}px`,
            } as React.CSSProperties}
          >
            {mode === "padding" && (
              <>
                <div className={`${styles.indicator} ${styles.top}`} />
                <div className={`${styles.indicator} ${styles.right}`} />
                <div className={`${styles.indicator} ${styles.bottom}`} />
                <div className={`${styles.indicator} ${styles.left}`} />
              </>
            )}
            {mode === "margin" && (
              <div className={styles.visualBoxInner} style={{
                top: `${Math.min(value.top * indicatorScale, 24)}px`,
                right: `${Math.min(value.right * indicatorScale, 24)}px`,
                bottom: `${Math.min(value.bottom * indicatorScale, 24)}px`,
                left: `${Math.min(value.left * indicatorScale, 24)}px`,
              }} />
            )}
          </div>

          <SpacingLevelInput
            value={value.right}
            onChange={(v) => handleSideChange("right", v)}
            disabled={disabled}
            compact
          />
        </div>

        {/* Bottom input */}
        <div className={styles.bottomRow}>
          <SpacingLevelInput
            value={value.bottom}
            onChange={(v) => handleSideChange("bottom", v)}
            disabled={disabled}
            compact
          />
        </div>
      </div>

      {/* Link toggle */}
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.linkToggle} ${value.linked ? styles.linked : ""}`}
          onClick={toggleLinked}
          disabled={disabled}
          title={value.linked ? "Unlink sides" : "Link all sides"}
        >
          {value.linked ? <Link2 /> : <Unlink2 />}
        </button>
        <span className={styles.footerLabel}>
          {value.linked ? "Linked" : "Independent"}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Radius Control
// ============================================================================

interface RadiusControlInternalProps {
  value: FourCornerRadius;
  onChange: (value: FourCornerRadius) => void;
  disabled: boolean;
  compact: boolean;
}

function RadiusControl({
  value,
  onChange,
  disabled,
  compact,
}: RadiusControlInternalProps) {
  const handleCornerChange = (
    corner: "topLeft" | "topRight" | "bottomRight" | "bottomLeft",
    newValue: SpacingLevel
  ) => {
    if (value.linked) {
      // When linked, update all corners
      onChange({
        topLeft: newValue,
        topRight: newValue,
        bottomRight: newValue,
        bottomLeft: newValue,
        linked: true,
      });
    } else {
      // When unlinked, update only the specific corner
      onChange({
        ...value,
        [corner]: newValue,
      });
    }
  };

  const toggleLinked = () => {
    if (!value.linked) {
      // When linking, sync all to the topLeft value
      onChange({
        topLeft: value.topLeft,
        topRight: value.topLeft,
        bottomRight: value.topLeft,
        bottomLeft: value.topLeft,
        linked: true,
      });
    } else {
      onChange({
        ...value,
        linked: false,
      });
    }
  };

  if (compact) {
    return (
      <div className={`${styles.container} ${styles.compact}`}>
        <div className={styles.inputGroup}>
          <span className={styles.label}>TL</span>
          <SpacingLevelInput
            value={value.topLeft}
            onChange={(v) => handleCornerChange("topLeft", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>TR</span>
          <SpacingLevelInput
            value={value.topRight}
            onChange={(v) => handleCornerChange("topRight", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>BR</span>
          <SpacingLevelInput
            value={value.bottomRight}
            onChange={(v) => handleCornerChange("bottomRight", v)}
            disabled={disabled}
            compact
          />
        </div>
        <div className={styles.inputGroup}>
          <span className={styles.label}>BL</span>
          <SpacingLevelInput
            value={value.bottomLeft}
            onChange={(v) => handleCornerChange("bottomLeft", v)}
            disabled={disabled}
            compact
          />
        </div>
        <button
          type="button"
          className={`${styles.linkToggle} ${value.linked ? styles.linked : ""}`}
          onClick={toggleLinked}
          disabled={disabled}
          title={value.linked ? "Unlink corners" : "Link all corners"}
        >
          {value.linked ? <Link2 /> : <Unlink2 />}
        </button>
      </div>
    );
  }

  // Visual mode with radius preview
  const radiusScale = 3; // px per spacing level for visual indicator

  return (
    <div className={styles.container}>
      <div className={styles.radiusGrid}>
        {/* Top-left corner */}
        <div className={styles.radiusTopLeft}>
          <SpacingLevelInput
            value={value.topLeft}
            onChange={(v) => handleCornerChange("topLeft", v)}
            disabled={disabled}
            compact
          />
        </div>

        {/* Top-right corner */}
        <div className={styles.radiusTopRight}>
          <SpacingLevelInput
            value={value.topRight}
            onChange={(v) => handleCornerChange("topRight", v)}
            disabled={disabled}
            compact
          />
        </div>

        {/* Visual box */}
        <div
          className={`${styles.visualBox} ${styles.radiusBox}`}
          style={{
            "--corner-tl": `${Math.min(value.topLeft * radiusScale, 20)}px`,
            "--corner-tr": `${Math.min(value.topRight * radiusScale, 20)}px`,
            "--corner-br": `${Math.min(value.bottomRight * radiusScale, 20)}px`,
            "--corner-bl": `${Math.min(value.bottomLeft * radiusScale, 20)}px`,
            borderRadius: `${Math.min(value.topLeft * radiusScale, 20)}px ${Math.min(value.topRight * radiusScale, 20)}px ${Math.min(value.bottomRight * radiusScale, 20)}px ${Math.min(value.bottomLeft * radiusScale, 20)}px`,
          } as React.CSSProperties}
        >
          <div className={`${styles.radiusCorner} ${styles.topLeft}`} />
          <div className={`${styles.radiusCorner} ${styles.topRight}`} />
          <div className={`${styles.radiusCorner} ${styles.bottomRight}`} />
          <div className={`${styles.radiusCorner} ${styles.bottomLeft}`} />
        </div>

        {/* Bottom-left corner */}
        <div className={styles.radiusBottomLeft}>
          <SpacingLevelInput
            value={value.bottomLeft}
            onChange={(v) => handleCornerChange("bottomLeft", v)}
            disabled={disabled}
            compact
          />
        </div>

        {/* Bottom-right corner */}
        <div className={styles.radiusBottomRight}>
          <SpacingLevelInput
            value={value.bottomRight}
            onChange={(v) => handleCornerChange("bottomRight", v)}
            disabled={disabled}
            compact
          />
        </div>
      </div>

      {/* Link toggle */}
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.linkToggle} ${value.linked ? styles.linked : ""}`}
          onClick={toggleLinked}
          disabled={disabled}
          title={value.linked ? "Unlink corners" : "Link all corners"}
        >
          {value.linked ? <Link2 /> : <Unlink2 />}
        </button>
        <span className={styles.footerLabel}>
          {value.linked ? "Linked" : "Independent"}
        </span>
      </div>
    </div>
  );
}
