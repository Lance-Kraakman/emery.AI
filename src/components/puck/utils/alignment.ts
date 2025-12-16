/**
 * Alignment Utilities for Puck Components
 * 
 * Provides standardized alignment functionality including:
 * - Type definitions for alignment values
 * - Utility functions for mapping alignment values
 * - CSS class generation helpers
 */

// Type definitions for standardized alignment values
export type TextAlign = "left" | "center" | "right" | "justify";
export type JustifyContent = "start" | "center" | "end" | "space-between" | "space-around";
export type AlignItems = "start" | "center" | "end" | "stretch";
export type AlignSelf = "auto" | "start" | "center" | "end" | "stretch";
export type JustifyItems = "start" | "center" | "end" | "stretch";
export type AlignContent = "start" | "center" | "end" | "stretch";

/**
 * Map Puck alignment values to CSS flexbox values
 */
export function mapFlexAlignment(value: string): string {
  const flexMap: Record<string, string> = {
    'start': 'flex-start',
    'end': 'flex-end',
    'center': 'center',
    'stretch': 'stretch',
    'space-between': 'space-between',
    'space-around': 'space-around',
  };
  return flexMap[value] || value;
}

/**
 * Generate CSS object for text alignment
 */
export function getTextAlignmentCSS(textAlign?: TextAlign): React.CSSProperties {
  if (!textAlign) return {};
  return { textAlign };
}

/**
 * Generate CSS object for flex container alignment
 */
export function getFlexAlignmentCSS(
  justifyContent?: JustifyContent,
  alignItems?: AlignItems
): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  if (justifyContent) {
    css.justifyContent = mapFlexAlignment(justifyContent);
  }
  
  if (alignItems) {
    css.alignItems = mapFlexAlignment(alignItems);
  }
  
  return css;
}

/**
 * Generate CSS object for grid container alignment
 */
export function getGridAlignmentCSS(
  justifyItems?: JustifyItems,
  alignContent?: AlignContent
): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  if (justifyItems) {
    css.justifyItems = mapFlexAlignment(justifyItems);
  }
  
  if (alignContent) {
    css.alignContent = mapFlexAlignment(alignContent);
  }
  
  return css;
}

/**
 * Generate CSS object for flex/grid item alignment
 */
export function getItemAlignmentCSS(alignSelf?: AlignSelf): React.CSSProperties {
  if (!alignSelf) return {};
  
  const css: React.CSSProperties = {};
  
  if (alignSelf === 'auto') {
    css.alignSelf = 'auto';
  } else {
    css.alignSelf = mapFlexAlignment(alignSelf);
  }
  
  return css;
}

/**
 * Generate comprehensive alignment CSS object
 * Combines text, container, and item alignment
 */
export function getAlignmentCSS(
  options: {
    textAlign?: TextAlign;
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    justifyItems?: JustifyItems;
    alignContent?: AlignContent;
    alignSelf?: AlignSelf;
  }
): React.CSSProperties {
  const css: React.CSSProperties = {};
  
  // Text alignment
  Object.assign(css, getTextAlignmentCSS(options.textAlign));
  
  // Flex container alignment
  Object.assign(css, getFlexAlignmentCSS(
    options.justifyContent,
    options.alignItems
  ));
  
  // Grid container alignment
  Object.assign(css, getGridAlignmentCSS(
    options.justifyItems,
    options.alignContent
  ));
  
  // Item alignment
  Object.assign(css, getItemAlignmentCSS(options.alignSelf));
  
  return css;
}

/**
 * Generate CSS classes for alignment
 * Used with CSS modules for better performance
 */
export function getAlignmentClasses(
  options: {
    textAlign?: TextAlign;
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    justifyItems?: JustifyItems;
    alignContent?: AlignContent;
    alignSelf?: AlignSelf;
  },
  prefix: string = "puck"
): string[] {
  const classes: string[] = [];
  
  if (options.textAlign) {
    classes.push(`${prefix}-text-${options.textAlign}`);
  }
  
  if (options.justifyContent) {
    classes.push(`${prefix}-justify-${options.justifyContent}`);
  }
  
  if (options.alignItems) {
    classes.push(`${prefix}-align-${options.alignItems}`);
  }
  
  if (options.justifyItems) {
    classes.push(`${prefix}-justify-items-${options.justifyItems}`);
  }
  
  if (options.alignContent) {
    classes.push(`${prefix}-align-content-${options.alignContent}`);
  }
  
  if (options.alignSelf) {
    classes.push(`${prefix}-align-self-${options.alignSelf}`);
  }
  
  return classes;
}

/**
 * Validate alignment value combinations
 * Prevents invalid CSS combinations
 */
export function validateAlignment(
  options: {
    textAlign?: TextAlign;
    justifyContent?: JustifyContent;
    alignItems?: AlignItems;
    justifyItems?: JustifyItems;
    alignContent?: AlignContent;
    alignSelf?: AlignSelf;
  }
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for invalid combinations
  if (options.justifyContent && options.justifyItems) {
    errors.push("Cannot use both justifyContent (flex) and justifyItems (grid) together");
  }
  
  if (options.alignItems && options.alignContent) {
    errors.push("Cannot use both alignItems (flex) and alignContent (grid) together");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}