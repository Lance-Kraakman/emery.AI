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
  tableApplicationService: TableApplicationService;
}

export function registerViewServices(
  deps: ViewDependencies
): ViewServices {
  const { db, tableApplicationService } = deps;

  // Register repository
  const viewRepository = new DrizzleViewRepository(db);

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
