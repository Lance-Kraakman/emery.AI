/**
 * LinkContext - React Context for Link Resolution in Puck
 *
 * AIDEV-NOTE: Provides org/app/page context to Puck components for proper link resolution.
 * This enables Button components and other link-containing components to construct
 * correct URLs without needing to pass context through every level of props.
 *
 * Usage:
 * - Wrap Puck instances with LinkContextProvider
 * - Components use useLinkContext() to access link resolution data
 * - Context includes: orgSlug, appSlug, pages, isEditing, isPreview
 */

"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PageDTO } from "@/app/mappers/puck-page-mapper";

export interface LinkContextValue {
  /** Organization slug for constructing public URLs */
  orgSlug?: string;

  /** App slug for constructing public URLs */
  appSlug?: string;

  /** App ID for constructing preview URLs */
  appId?: number;

  /** Map or array of pages for link resolution */
  pages?: Map<number, PageDTO> | PageDTO[];

  /** Whether we're in the Puck editor */
  isEditing?: boolean;

  /** Whether we're in preview mode */
  isPreview?: boolean;
}

// Create context with empty object default
const LinkContext = createContext<LinkContextValue>({});

export interface LinkContextProviderProps {
  children: ReactNode;
  value: LinkContextValue;
}

/**
 * LinkContextProvider - Provides link resolution context to all child components
 */
export function LinkContextProvider({ children, value }: LinkContextProviderProps) {
  return (
    <LinkContext.Provider value={value}>
      {children}
    </LinkContext.Provider>
  );
}

/**
 * useLinkContext - Hook to access link context in components
 * Returns the provided context or empty object if not in a LinkContextProvider
 */
export function useLinkContext(): LinkContextValue {
  return useContext(LinkContext);
}
