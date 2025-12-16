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

import type { DbClient } from "@/lib/db/client";
import type { ContextAwareDbClient } from "@/lib/db/simple-context-proxy";
import type { ViewRepository } from "@/ddd/domain/views/repositories/view-repository";
import type { TableApplicationService } from "@/ddd/application/services/tables/table-application-service";

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
}

export function registerViewServices(
  deps: ViewDependencies
): ViewServices {
  const { db, rawDb, tableApplicationService } = deps;

  // Register repository with both context-aware and raw db clients
  const viewRepository = new DrizzleViewRepository(db, rawDb);

  // Register application service
  const viewApplicationService = new ViewApplicationService(
    viewRepository,
    tableApplicationService
  );

  return {
    viewRepository,
    viewApplicationService,
  };
}
