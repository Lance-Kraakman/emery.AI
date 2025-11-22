/**
 * Link Action Resolution Utility
 *
 * Resolves a LinkActionConfig to an actual href/onClick handler
 * that can be used in button/link components.
 */

import { signIn, signOut } from 'next-auth/react';
import type { LinkActionConfig } from '../custom-fields/link-action-field';
import type { PageDTO } from '@/app/mappers/puck-page-mapper';

export interface ResolvedLinkAction {
  /** The href to use for the link/button */
  href: string;

  /** Optional click handler (for auth actions) */
  onClick?: (e: React.MouseEvent) => void;

  /** Target attribute (_blank for new tab) */
  target?: string;

  /** Rel attribute (for external links) */
  rel?: string;
}

export interface LinkResolutionContext {
  /** Organization slug (for constructing public page URLs) */
  orgSlug?: string;

  /** App slug (for constructing public page URLs) */
  appSlug?: string;

  /** App ID (for constructing preview URLs) */
  appId?: number;

  /** Map of page IDs to page data (for resolving page links) */
  pages?: Map<number, PageDTO> | PageDTO[];

  /** Whether we're in the Puck editor (to prevent navigation) */
  isEditing?: boolean;

  /** Whether we're in preview mode (affects URL generation) */
  isPreview?: boolean;
}

/**
 * Helper to find a page by ID from the pages context
 */
function findPage(pageId: number, pages?: Map<number, PageDTO> | PageDTO[]): PageDTO | undefined {
  if (!pages) return undefined;

  if (Array.isArray(pages)) {
    return pages.find(p => p.id === pageId);
  }

  return pages.get(pageId);
}

/**
 * Resolve a LinkActionConfig to an actual link/button action
 */
/**
 * Helper to append anchor ID to URL if provided
 */
function appendAnchor(href: string, anchorId?: string): string {
  if (!anchorId) return href;
  // Remove leading # if user included it
  const cleanAnchor = anchorId.startsWith('#') ? anchorId.slice(1) : anchorId;
  return cleanAnchor ? `${href}#${cleanAnchor}` : href;
}

export function resolveLinkAction(
  config: LinkActionConfig | undefined,
  context: LinkResolutionContext = {}
): ResolvedLinkAction {
  // No config or no action type
  if (!config || !config.actionType || config.actionType === 'none') {
    return { href: '#' };
  }

  // Custom href always takes precedence
  if (config.customHref) {
    return {
      href: appendAnchor(config.customHref, config.anchorId),
      target: config.openInNewTab ? '_blank' : undefined,
      rel: config.openInNewTab ? 'noopener noreferrer' : undefined,
    };
  }

  switch (config.actionType) {
    case 'page': {
      // Resolve page link
      if (!config.pageId) {
        return { href: '#' };
      }

      const page = findPage(config.pageId, context.pages);
      if (!page) {
        // If we don't have page data, we can't construct the URL
        // In the editor, this might happen - just return a placeholder
        return { href: `#page-${config.pageId}` };
      }

      // In preview mode, link to preview URLs instead of public URLs
      // This allows previewing unpublished pages
      if (context.isPreview && context.appId) {
        return {
          href: appendAnchor(`/apps/${context.appId}/pages/${config.pageId}/preview`, config.anchorId),
        };
      }

      // In editor or public mode with published pages, use public URLs
      if (context.orgSlug && context.appSlug) {
        return {
          href: appendAnchor(`/public/${context.orgSlug}/${context.appSlug}/${page.slug}`, config.anchorId),
        };
      }

      // Fallback if we don't have org/app context
      return { href: appendAnchor(`#${page.slug}`, config.anchorId) };
    }

    case 'url': {
      // External/custom URL
      const url = config.url || '#';
      return {
        href: appendAnchor(url, config.anchorId),
        target: config.openInNewTab ? '_blank' : undefined,
        rel: config.openInNewTab ? 'noopener noreferrer' : undefined,
      };
    }

    case 'signIn': {
      // Sign in action
      const handleSignIn = (e: React.MouseEvent) => {
        e.preventDefault();

        // Don't trigger sign in during editing
        if (context.isEditing) {
          return;
        }

        // Use default provider (you can make this configurable)
        signIn('github', {
          callbackUrl: config.redirectAfter || window.location.pathname,
        });
      };

      return {
        href: '#sign-in',
        onClick: handleSignIn,
      };
    }

    case 'signOut': {
      // Sign out action
      const handleSignOut = (e: React.MouseEvent) => {
        e.preventDefault();

        // Don't trigger sign out during editing
        if (context.isEditing) {
          return;
        }

        signOut({
          callbackUrl: config.redirectAfter || '/',
        });
      };

      return {
        href: '#sign-out',
        onClick: handleSignOut,
      };
    }

    default:
      return { href: '#' };
  }
}

/**
 * Async version that can fetch page data if needed
 * This can be used when you have the pageId but not the page data
 */
export async function resolveLinkActionAsync(
  config: LinkActionConfig | undefined,
  context: LinkResolutionContext = {},
  fetchPage?: (pageId: number) => Promise<PageDTO | null>
): Promise<ResolvedLinkAction> {
  if (!config || config.actionType !== 'page' || !config.pageId) {
    return resolveLinkAction(config, context);
  }

  // If we already have the page, use sync version
  const existingPage = findPage(config.pageId, context.pages);
  if (existingPage) {
    return resolveLinkAction(config, context);
  }

  // Try to fetch the page if a fetch function is provided
  if (fetchPage) {
    try {
      const page = await fetchPage(config.pageId);
      if (page) {
        // Add page to context and resolve
        const updatedContext = {
          ...context,
          pages: [...(Array.isArray(context.pages) ? context.pages : []), page],
        };
        return resolveLinkAction(config, updatedContext);
      }
    } catch (error) {
      console.error('Error fetching page for link resolution:', error);
    }
  }

  // Fallback to sync version
  return resolveLinkAction(config, context);
}
