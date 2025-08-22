// AIDEV-NOTE: Domain service for aggregating organization data for RAG indexing
// Coordinates between domain-specific repositories instead of duplicating queries

import { OrganizationId, type DomainType } from '../value-objects';
import {
  OrganizationDataSnapshot,
  TableDataSnapshot,
  FieldDataSnapshot,
  DatabaseDataSnapshot,
  AgentDataSnapshot,
  TeamDataSnapshot,
  FileDataSnapshot
} from '../value-objects/data-snapshots';

import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { ITeamRepository } from '@/ddd/domain/teams/repositories/team-repository';
import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';

/**
 * Domain service that aggregates organization data for RAG indexing
 * Uses existing domain repositories instead of duplicating functionality
 */
export interface IOrganizationDataService {
  /**
   * Get organization data as snapshot for RAG indexing
   */
  getOrganizationData(organizationId: OrganizationId): Promise<OrganizationDataSnapshot | null>;

  /**
   * Get table data with fields for RAG indexing
   */
  getTableData(organizationId: OrganizationId): Promise<TableDataSnapshot[]>;

  /**
   * Get database data for RAG indexing
   */
  getDatabaseData(organizationId: OrganizationId): Promise<DatabaseDataSnapshot[]>;

  /**
   * Get agent data for RAG indexing
   */
  getAgentData(organizationId: OrganizationId): Promise<AgentDataSnapshot[]>;

  /**
   * Get team data for RAG indexing
   */
  getTeamData(organizationId: OrganizationId): Promise<TeamDataSnapshot[]>;

  /**
   * Get file data for RAG indexing
   */
  getFileData(organizationId: OrganizationId): Promise<FileDataSnapshot[]>;

  /**
   * Get data for specific domain types
   */
  getDataForDomainTypes(
    organizationId: OrganizationId, 
    domainTypes: DomainType[]
  ): Promise<{
    organizations?: OrganizationDataSnapshot[];
    tables?: TableDataSnapshot[];
    databases?: DatabaseDataSnapshot[];
    agents?: AgentDataSnapshot[];
    teams?: TeamDataSnapshot[];
    files?: FileDataSnapshot[];
  }>;

  /**
   * Get data counts for each domain type
   */
  getDataCounts(organizationId: OrganizationId): Promise<Record<DomainType, number>>;
}

/**
 * Implementation of organization data service using domain repositories
 */
export class OrganizationDataService implements IOrganizationDataService {
  constructor(
    private readonly organizationRepository: IOrganizationRepository,
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository,
    private readonly agentRepository: IAgentRepository,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly teamRepository: ITeamRepository,
    private readonly fileRepository: IFileStorageRepository
  ) {}

  async getOrganizationData(organizationId: OrganizationId): Promise<OrganizationDataSnapshot | null> {
    const organization = await this.organizationRepository.findById(organizationId.value);
    return organization ? OrganizationDataSnapshot.fromEntity(organization) : null;
  }

  async getTableData(organizationId: OrganizationId): Promise<TableDataSnapshot[]> {
    // Use the domain table repository
    const tables = await this.tableRepository.findByOrganization(organizationId.value);
    
    // Get fields for each table using the field repository
    const tablesWithFields = await Promise.all(
      tables.map(async (table) => {
        const fields = await this.fieldRepository.findByTableId(table.id);
        return TableDataSnapshot.fromEntity(table, fields);
      })
    );

    return tablesWithFields;
  }

  async getDatabaseData(organizationId: OrganizationId): Promise<DatabaseDataSnapshot[]> {
    const databases = await this.databaseRepository.findByOrganization(organizationId.value);
    return databases.map(database => DatabaseDataSnapshot.fromEntity(database));
  }

  async getAgentData(organizationId: OrganizationId): Promise<AgentDataSnapshot[]> {
    const agents = await this.agentRepository.findByOrganization(organizationId.value);
    return agents.map(agent => AgentDataSnapshot.fromEntity(agent));
  }

  async getTeamData(organizationId: OrganizationId): Promise<TeamDataSnapshot[]> {
    const teams = await this.teamRepository.findByOrganization(organizationId.value);
    return teams.map(team => TeamDataSnapshot.fromEntity(team));
  }

  async getFileData(organizationId: OrganizationId): Promise<FileDataSnapshot[]> {
    // File data is more complex as it involves fields and tables
    // For now, get basic file storage data from the file repository
    const files = await this.fileRepository.findByOrganization(organizationId.value);
    return files.map(file => FileDataSnapshot.fromEntity(file));
  }

  async getDataForDomainTypes(
    organizationId: OrganizationId, 
    domainTypes: DomainType[]
  ): Promise<{
    organizations?: OrganizationDataSnapshot[];
    tables?: TableDataSnapshot[];
    databases?: DatabaseDataSnapshot[];
    agents?: AgentDataSnapshot[];
    teams?: TeamDataSnapshot[];
    files?: FileDataSnapshot[];
  }> {
    const result: any = {};

    for (const domainType of domainTypes) {
      switch (domainType) {
        case 'organization':
          const orgData = await this.getOrganizationData(organizationId);
          result.organizations = orgData ? [orgData] : [];
          break;

        case 'table':
          result.tables = await this.getTableData(organizationId);
          break;

        case 'database':
          result.databases = await this.getDatabaseData(organizationId);
          break;

        case 'agent':
          result.agents = await this.getAgentData(organizationId);
          break;

        case 'team':
          result.teams = await this.getTeamData(organizationId);
          break;

        case 'file':
          result.files = await this.getFileData(organizationId);
          break;

        default:
          console.warn(`[ORG-DATA-SERVICE] Unsupported domain type: ${domainType}`);
      }
    }

    return result;
  }

  async getDataCounts(organizationId: OrganizationId): Promise<Record<DomainType, number>> {
    // Use domain repositories to get accurate counts
    const [tables, databaseCount, agentCount, teamCount, fileCount] = await Promise.all([
      this.getTableData(organizationId),
      this.databaseRepository.countByOrganization(organizationId.value),
      this.agentRepository.countByOrganization(organizationId.value),
      this.teamRepository.countByOrganization(organizationId.value),
      this.fileRepository.countByOrganization(organizationId.value)
    ]);

    return {
      organization: 1, // Always 1 for the organization itself
      table: tables.length,
      database: databaseCount,
      agent: agentCount,
      team: teamCount,
      file: fileCount
    };
  }
}