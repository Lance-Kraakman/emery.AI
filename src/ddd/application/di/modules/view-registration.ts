/**
 * Data Source Domain Registration Module
 *
 * Registers repositories and services for view domain:
 * - Data source repository
 * - Data source application service
 *
 * AIDEV-NOTE: Data sources enable Puck components to connect with dynamic table data.
 * Provides filtering, sorting, and pagination capabilities for table data.
 */

import type { DbClient } from "@/ddd/infrastructure/db/client";
import type { ContextAwareDbClient } from "@/ddd/infrastructure/db/simple-context-proxy";
import type { ViewRepository } from "@/ddd/domain/views/repositories/view-repository";
import type { TableApplicationService } from "@/ddd/application/services/tables/table-application-service";
import type { RowApplicationService } from "@/ddd/application/services/tables/row-application-service";

import { DrizzleViewRepository } from "@/ddd/infrastructure/db/repositories/views/drizzle-view-repository";
import { ViewApplicationService } from "@/ddd/application/services/views/view-application-service";

export interface ViewServices {
  viewRepository: ViewRepository;
  viewApplicationService: ViewApplicationService;
}

export interface ViewDependencies {
  db: ContextAwareDbClient;
  rawDb: DbClient; // Raw db for public queries (bypasses RLS)
  tableApplicationService: TableApplicationService;
  rowApplicationService: RowApplicationService;
}

export function registerViewServices(
  deps: ViewDependencies
): ViewServices {
  const { db, rawDb, tableApplicationService, rowApplicationService } = deps;

  // Register repository with both context-aware and raw db clients
  const viewRepository = new DrizzleViewRepository(db, rawDb);

  // Register application service
  const viewApplicationService = new ViewApplicationService(
    viewRepository,
    tableApplicationService,
    rowApplicationService
  );

  return {
    viewRepository,
    viewApplicationService,
  };
}
