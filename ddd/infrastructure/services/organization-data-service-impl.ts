// AIDEV-NOTE: Infrastructure implementation of OrganizationDataService
// Uses concrete repository implementations to provide data for RAG indexing

import { OrganizationDataService } from '@/ddd/domain/rag/services/organization-data-service';
import { DrizzleOrganizationRepository } from '@/ddd/infrastructure/db/repositories/organizations/drizzle-organization-repository';
import { DrizzleDynamicTableRepository } from '@/ddd/infrastructure/db/repositories/tables/drizzle-dynamic-table-repository';
import { DrizzleFieldRepository } from '@/ddd/infrastructure/db/repositories/fields/drizzle-field-repository';
import { DrizzleAgentRepository } from '@/ddd/infrastructure/db/repositories/agents/drizzle-agent-repository';
import { DrizzleDatabaseRepository } from '@/ddd/infrastructure/db/repositories/databases/drizzle-database-repository';
import { DrizzleTeamRepository } from '@/ddd/infrastructure/db/repositories/teams/drizzle-team-repository';
import { DrizzleFileStorageRepository } from '@/ddd/infrastructure/db/repositories/files/drizzle-file-storage-repository';
import type { DbClient } from '@/lib/db/client';
import postgres from 'postgres';

/**
 * Factory for creating OrganizationDataService with proper dependencies
 */
export class OrganizationDataServiceFactory {
  static create(db: DbClient, raw: postgres.Sql): OrganizationDataService {
    // Create concrete repository implementations
    const organizationRepository = new DrizzleOrganizationRepository(db, raw);
    const tableRepository = new DrizzleDynamicTableRepository(db, raw);
    const fieldRepository = new DrizzleFieldRepository(db, raw);
    const agentRepository = new DrizzleAgentRepository(db);
    const databaseRepository = new DrizzleDatabaseRepository(db);
    const teamRepository = new DrizzleTeamRepository(db);
    const fileRepository = new DrizzleFileStorageRepository(db);

    // Return configured service
    return new OrganizationDataService(
      organizationRepository,
      tableRepository,
      fieldRepository,
      agentRepository,
      databaseRepository,
      teamRepository,
      fileRepository
    );
  }
}