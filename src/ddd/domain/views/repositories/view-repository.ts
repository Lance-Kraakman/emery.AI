/**
 * View Repository Interface
 *
 * AIDEV-NOTE: Repository interface for view persistence (formerly DataSourceRepository).
 * Views represent filtered/sorted table configurations (Baserow view pattern).
 * Follows DDD repository pattern - interface in domain, implementation in infrastructure.
 */

import { View } from "../entities/view";
import { ViewId } from "../value-objects/view-id";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";

export interface ViewRepository {
  /**
   * Save a new view or update an existing one
   */
  save(view: View): Promise<View>;

  /**
   * Find a view by its ID
   */
  findById(id: ViewId): Promise<View | null>;

  /**
   * Find a public view by its ID (bypasses RLS)
   * Only returns views where requiresAuth = false
   */
  findByIdPublic(id: ViewId): Promise<View | null>;

  /**
   * Find fields for a public view's table (bypasses RLS)
   * Only returns fields if the view is public (requiresAuth = false)
   */
  findFieldsForPublicView(viewId: ViewId): Promise<import("@/ddd/domain/tables/value-objects/table-field").TableField[] | null>;

  /**
   * Find table metadata for a public view (bypasses RLS)
   * Only returns table if the view is public (requiresAuth = false)
   */
  findTableForPublicView(viewId: ViewId): Promise<{
    tableId: number;
    organizationId: number;
    databaseId: number;
    s3Path: string;
  } | null>;

  /**
   * Find all views for a specific table
   */
  findByTableId(tableId: TableId): Promise<View[]>;

  /**
   * Find all views for an organization
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<View[]>;

  /**
   * Find a view by name within an organization
   */
  findByName(organizationId: OrganizationId, name: string): Promise<View | null>;

  /**
   * Delete a view
   */
  delete(id: ViewId): Promise<void>;

  /**
   * Check if a view name exists in an organization
   */
  existsByName(organizationId: OrganizationId, name: string): Promise<boolean>;
}
