/**
 * Database Domain Registration Module
 *
 * Registers repositories and services for database domain:
 * - Database repository
 * - Dynamic table repository
 * - File storage repository
 * - Table application service (table/field CRUD)
 * - Row application service (row CRUD)
 * - Table event coordinator service (trigger handling)
 * - File application service
 * - Document application service
 * - Database application service
 */

import type { ContextAwareDbClient } from '@/ddd/infrastructure/db/simple-context-proxy';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { ITriggerMatchingService } from '@/ddd/domain/scheduling/services/trigger-matching-service';
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';

import { DrizzleDatabaseRepository } from '@/ddd/infrastructure/db/repositories/databases/drizzle-database-repository';
import { DynamicTableRepository } from '@/ddd/infrastructure/db/repositories/tables/dynamic-table-repository';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { GrpcTableClient } from '@/ddd/infrastructure/db/repositories/tables/table-grpc-client';
import { DynamicTableDataLake } from '@/ddd/infrastructure/db/repositories/tables/dynamic-table-datalake';

import { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import { RowApplicationService } from '@/ddd/application/services/tables/row-application-service';
import { TableEventCoordinatorService } from '@/ddd/application/services/tables/table-event-coordinator-service';
import { FileUseCases } from '@/ddd/application/services/tables/file-application-service';
import { DocumentApplicationService } from '@/ddd/application/services/tables/document-application-service';

export interface DatabaseServices {
  databaseRepository: IDatabaseRepository;
  dynamicTableRepository: IDynamicTableRepository;
  fileStorageRepository: IFileStorageRepository;
  dynamicTableService: DynamicTableService;
  databaseApplicationService: DatabaseApplicationService;
  tableApplicationService: TableApplicationService;
  rowApplicationService: RowApplicationService;
  tableEventCoordinatorService: TableEventCoordinatorService;
  fileApplicationService: FileUseCases;
  documentApplicationService: DocumentApplicationService;
}

export interface DatabaseDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
  triggerMatchingService?: ITriggerMatchingService;
  taskRepository?: ITaskRepository;
  skillRepository?: ISkillRepository;
}

export function registerDatabaseServices(deps: DatabaseDependencies): DatabaseServices {
  const { db, organizationRepository, triggerMatchingService, taskRepository, skillRepository } = deps;

  // Register repositories
  const databaseRepository = new DrizzleDatabaseRepository(db);
  const fileStorageRepository = new S3FileStorageRepository();

  // Create gRPC client and data lake service
  // Use tools port to avoid circular dependency with Python tools
  const grpcClient = new GrpcTableClient({
    address: process.env.GRPC_TOOLS_ADDRESS || 'localhost:50052',
    timeout: 30000
  });
  const datalake = new DynamicTableDataLake(grpcClient);

  // Create table repository with data lake
  const dynamicTableRepository = new DynamicTableRepository(db, datalake);

  // Create domain service
  const dynamicTableService = new DynamicTableService(dynamicTableRepository);

  // Create application services
  const databaseApplicationService = new DatabaseApplicationService(
    dynamicTableRepository,
    databaseRepository
  );

  // Table/field CRUD service
  const tableApplicationService = new TableApplicationService(
    dynamicTableService,
    databaseRepository,
    organizationRepository,
    dynamicTableRepository
  );

  // Event coordinator for trigger handling
  const tableEventCoordinatorService = new TableEventCoordinatorService(
    triggerMatchingService,
    taskRepository,
    skillRepository
  );

  // Row CRUD service (depends on event coordinator for triggers)
  const rowApplicationService = new RowApplicationService(
    dynamicTableService,
    dynamicTableRepository,
    tableEventCoordinatorService
  );

  const fileApplicationService = new FileUseCases(
    fileStorageRepository,
    dynamicTableService
  );

  const documentApplicationService = new DocumentApplicationService(
    fileApplicationService,
    fileStorageRepository,
    dynamicTableService,
    dynamicTableRepository
  );

  return {
    databaseRepository,
    dynamicTableRepository,
    fileStorageRepository,
    dynamicTableService,
    databaseApplicationService,
    tableApplicationService,
    rowApplicationService,
    tableEventCoordinatorService,
    fileApplicationService,
    documentApplicationService
  };
}
