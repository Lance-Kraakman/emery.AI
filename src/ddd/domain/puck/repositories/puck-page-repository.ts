// AIDEV-NOTE: PuckPage repository interface - defines data access contract
// Implementation will be in infrastructure layer using Drizzle

import type { PuckPage } from '../entities/puck-page';
import type { PageId } from '../value-objects/page-id';
import type { AppId } from '../value-objects/app-id';
import type { PageSlug } from '../value-objects/page-slug';
import type { PageOrder } from '../value-objects/page-order';

export interface IPuckPageRepository {
  /**
   * Find a page by its ID
   */
  findById(id: PageId): Promise<PuckPage | null>;

  /**
   * Find all pages for an app (ordered by page.order)
   */
  findByApp(appId: AppId): Promise<PuckPage[]>;

  /**
   * Find a page by slug within an app
   */
  findBySlug(appId: AppId, slug: PageSlug): Promise<PuckPage | null>;

  /**
   * Check if a slug exists within an app
   */
  existsBySlug(appId: AppId, slug: PageSlug): Promise<boolean>;

  /**
   * Create a new page
   */
  create(page: PuckPage): Promise<PuckPage>;

  /**
   * Update an existing page
   */
  update(page: PuckPage): Promise<PuckPage>;

  /**
   * Delete a page
   */
  delete(id: PageId): Promise<void>;

  /**
   * Reorder pages within an app
   * Updates the order field for multiple pages in a single transaction
   */
  reorderPages(appId: AppId, pageOrders: Map<PageId, PageOrder>): Promise<void>;

  /**
   * Count pages for an app
   */
  countByApp(appId: AppId): Promise<number>;

  /**
   * Get the maximum order value for pages in an app
   * Useful for determining the order for a new page
   */
  getMaxOrder(appId: AppId): Promise<number>;

  /**
   * Find all published pages for an app
   */
  findPublishedByApp(appId: AppId): Promise<PuckPage[]>;
}
