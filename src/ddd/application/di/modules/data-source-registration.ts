/**
 * Data Source Domain Registration Module
 *
 * Registers repositories and services for data source domain:
 * - Data source repository
 * - Data source application service
 *
 * AIDEV-NOTE: Data sources enable Puck components to connect with dynamic table data.
 * Provides filtering, sorting, and pagination capabilities for table data.
 */

import type { ContextAwareDbClient } from "@/lib/db/simple-context-proxy";
import type { DataSourceRepository } from "@/ddd/domain/data-sources/repositories/data-source-repository";
import type { TableApplicationService } from "@/ddd/application/services/tables/table-application-service";

import { DrizzleDataSourceRepository } from "@/ddd/infrastructure/db/repositories/data-sources/drizzle-data-source-repository";
import { DataSourceApplicationService } from "@/ddd/application/services/data-sources/data-source-application-service";

export interface DataSourceServices {
  dataSourceRepository: DataSourceRepository;
  dataSourceApplicationService: DataSourceApplicationService;
}

export interface DataSourceDependencies {
  db: ContextAwareDbClient;
  tableApplicationService: TableApplicationService;
}

export function registerDataSourceServices(
  deps: DataSourceDependencies
): DataSourceServices {
  const { db, tableApplicationService } = deps;

  // Register repository
  const dataSourceRepository = new DrizzleDataSourceRepository(db);

  // Register application service
  const dataSourceApplicationService = new DataSourceApplicationService(
    dataSourceRepository,
    tableApplicationService
  );

  return {
    dataSourceRepository,
    dataSourceApplicationService,
  };
}
