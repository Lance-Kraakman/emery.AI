// AIDEV-NOTE: Domain service for building navigation structures from pages
// Stateless service for navigation-related operations

import type { PuckPage } from '../entities/puck-page';

/**
 * Navigation item representing a page in the navigation tree
 */
export interface NavigationItem {
  id: number;
  name: string;
  slug: string;
  order: number;
  isPublished: boolean;
  children?: NavigationItem[]; // For future nested navigation support
}

export class PageNavigationService {
  /**
   * Build a flat navigation structure from pages
   * Pages are sorted by order
   */
  buildNavigation(pages: PuckPage[]): NavigationItem[] {
    return pages
      .map(page => ({
        id: page.id.value,
        name: page.name,
        slug: page.slug.value,
        order: page.order.value,
        isPublished: page.isPublished
      }))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Build a published-only navigation structure
   * Only includes pages that are published
   */
  buildPublishedNavigation(pages: PuckPage[]): NavigationItem[] {
    return pages
      .filter(page => page.isPublished)
      .map(page => ({
        id: page.id.value,
        name: page.name,
        slug: page.slug.value,
        order: page.order.value,
        isPublished: page.isPublished
      }))
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get the next available order value for a new page
   */
  getNextOrder(pages: PuckPage[]): number {
    if (pages.length === 0) {
      return 0;
    }

    const maxOrder = Math.max(...pages.map(p => p.order.value));
    return maxOrder + 1;
  }

  /**
   * Reorder pages - generates new order values for all pages
   * Returns a map of PageId -> new PageOrder value
   */
  calculateReorder(
    pages: PuckPage[],
    movedPageId: number,
    newPosition: number
  ): Map<number, number> {
    const orderMap = new Map<number, number>();

    // Sort pages by current order
    const sortedPages = [...pages].sort((a, b) => a.order.value - b.order.value);

    // Find the moved page
    const movedPageIndex = sortedPages.findIndex(p => p.id.value === movedPageId);
    if (movedPageIndex === -1) {
      return orderMap; // Page not found
    }

    // Remove from current position
    const [movedPage] = sortedPages.splice(movedPageIndex, 1);

    // Insert at new position
    sortedPages.splice(newPosition, 0, movedPage);

    // Assign new order values
    sortedPages.forEach((page, index) => {
      orderMap.set(page.id.value, index);
    });

    return orderMap;
  }
}
