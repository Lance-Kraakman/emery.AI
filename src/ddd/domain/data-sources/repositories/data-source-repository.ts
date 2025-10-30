/**
 * DataSource Repository Interface
 *
 * AIDEV-NOTE: Repository interface for data source persistence.
 * Follows DDD repository pattern - interface in domain, implementation in infrastructure.
 */

import { DataSource } from "../entities/data-source";
import { DataSourceId } from "../value-objects/data-source-id";
import { TableId } from "@/ddd/domain/shared/value-objects/table-id";
import { OrganizationId } from "@/ddd/domain/shared/value-objects/organization-id";

export interface DataSourceRepository {
  /**
   * Save a new data source or update an existing one
   */
  save(dataSource: DataSource): Promise<DataSource>;

  /**
   * Find a data source by its ID
   */
  findById(id: DataSourceId): Promise<DataSource | null>;

  /**
   * Find all data sources for a specific table
   */
  findByTableId(tableId: TableId): Promise<DataSource[]>;

  /**
   * Find all data sources for an organization
   */
  findByOrganizationId(organizationId: OrganizationId): Promise<DataSource[]>;

  /**
   * Find a data source by name within an organization
   */
  findByName(organizationId: OrganizationId, name: string): Promise<DataSource | null>;

  /**
   * Delete a data source
   */
  delete(id: DataSourceId): Promise<void>;

  /**
   * Check if a data source name exists in an organization
   */
  existsByName(organizationId: OrganizationId, name: string): Promise<boolean>;
}
