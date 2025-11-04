/**
 * Database Domain Registration Module
 *
 * Registers repositories and services for database domain:
 * - Database repository
 * - Dynamic table repository
 * - File storage repository
 * - Table application service
 * - File application service
 * - Document application service
 * - Database application service
 */

import type { ContextAwareDbClient } from '@/lib/db/simple-context-proxy';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';

import { DrizzleDatabaseRepository } from '@/ddd/infrastructure/db/repositories/databases/drizzle-database-repository';
import { DynamicTableRepository } from '@/ddd/infrastructure/db/repositories/tables/dynamic-table-repository';
import { S3FileStorageRepository } from '@/ddd/infrastructure/storage/repositories/s3-file-storage-repository';
import { GrpcTableClient } from '@/ddd/infrastructure/db/repositories/tables/table-grpc-client';
import { DynamicTableDataLake } from '@/ddd/infrastructure/db/repositories/tables/dynamic-table-datalake';

import { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import { FileUseCases } from '@/ddd/application/services/tables/file-application-service';
import { DocumentApplicationService } from '@/ddd/application/services/tables/document-application-service';

export interface DatabaseServices {
  databaseRepository: IDatabaseRepository;
  dynamicTableRepository: IDynamicTableRepository;
  fileStorageRepository: IFileStorageRepository;
  dynamicTableService: DynamicTableService;
  databaseApplicationService: DatabaseApplicationService;
  tableApplicationService: TableApplicationService;
  fileApplicationService: FileUseCases;
  documentApplicationService: DocumentApplicationService;
}

export interface DatabaseDependencies {
  db: ContextAwareDbClient;
  organizationRepository: IOrganizationRepository;
}

export function registerDatabaseServices(deps: DatabaseDependencies): DatabaseServices {
  const { db, organizationRepository } = deps;

  // Register repositories
  const databaseRepository = new DrizzleDatabaseRepository(db);
  const fileStorageRepository = new S3FileStorageRepository();

  // Create gRPC client and data lake service
  const grpcClient = new GrpcTableClient({
    address: process.env.WORKER_ADDRESS || 'localhost:50051',
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

  const tableApplicationService = new TableApplicationService(
    dynamicTableService,
    databaseRepository,
    organizationRepository,
    dynamicTableRepository
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
    fileApplicationService,
    documentApplicationService
  };
}
