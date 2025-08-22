// AIDEV-NOTE: Repository interface for organization data access
// Provides access to organization, table, agent, and other domain data

import { OrganizationId, type DomainType } from '../value-objects';

export interface OrganizationData {
  id: number;
  name: string;
  mission?: string | null;
  sharedTools?: string[] | null;
  sharedServers?: string[] | null;
  createdAt?: Date | null;
}

export interface TableData {
  id: number;
  name: string;
  dbName: string;
  databaseId: number;
  metadata?: any;
  organizationId: number;
  databaseName?: string | null;
  databaseSlug?: string | null;
  fields?: FieldData[];
}

export interface FieldData {
  id: number;
  tableId: number;
  name: string;
  slug: string;
  type: string;
  orderIndex: number;
  relatedTableId?: number | null;
  required: boolean;
  createdAt: Date;
}

export interface DatabaseData {
  id: number;
  name: string;
  slug: string;
  metadata?: any;
  organizationId: number;
}

export interface AgentData {
  id: number;
  name: string;
  role?: string | null;
  description?: string | null;
  persona?: string | null;
  tools?: any;
  servers?: any;
  capabilities?: any;
  status?: string | null;
  createdAt?: Date | null;
}

export interface TeamData {
  id: number;
  name: string;
  purpose?: string | null;
  description?: string | null;
  responsibilities?: string[] | null;
  goals?: string[] | null;
  agentIds?: string[] | null;
  createdAt?: Date | null;
}

export interface FileData {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  s3Key: string;
  uploadedAt: Date;
  tableId: number;
  tableName: string;
  databaseName: string;
  fieldId: number;
  fieldName: string;
}

export interface OrganizationDataRepository {
  /**
   * Get organization data
   */
  getOrganizationData(organizationId: OrganizationId): Promise<OrganizationData | null>;

  /**
   * Get table data for an organization
   */
  getTableData(organizationId: OrganizationId): Promise<TableData[]>;

  /**
   * Get database data for an organization
   */
  getDatabaseData(organizationId: OrganizationId): Promise<DatabaseData[]>;

  /**
   * Get agent data for an organization
   */
  getAgentData(organizationId: OrganizationId): Promise<AgentData[]>;

  /**
   * Get team data for an organization
   */
  getTeamData(organizationId: OrganizationId): Promise<TeamData[]>;

  /**
   * Get file data for an organization
   */
  getFileData(organizationId: OrganizationId): Promise<FileData[]>;

  /**
   * Get data for specific domain types
   */
  getDataForDomainTypes(
    organizationId: OrganizationId, 
    domainTypes: DomainType[]
  ): Promise<{
    organizations?: OrganizationData[];
    tables?: TableData[];
    databases?: DatabaseData[];
    agents?: AgentData[];
    teams?: TeamData[];
    files?: FileData[];
  }>;

  /**
   * Get data counts for domain types
   */
  getDataCounts(organizationId: OrganizationId): Promise<Record<DomainType, number>>;
}