// AIDEV-NOTE: Drizzle implementation of OrganizationDataRepository
// Provides access to organization domain data using existing schema

import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '@/lib/db/client';
import { tables, fields, agents, organizations, databases, teams } from '@/lib/db/schema';

import { 
  type OrganizationDataRepository,
  type OrganizationData,
  type TableData,
  type DatabaseData,
  type AgentData,
  type TeamData,
  type FileData
} from '@/ddd/domain/rag/repositories';
import { OrganizationId, type DomainType } from '@/ddd/domain/rag/value-objects';

export class DrizzleOrganizationDataRepository implements OrganizationDataRepository {
  constructor(private readonly db: DbClient) {}

  async getOrganizationData(organizationId: OrganizationId): Promise<OrganizationData | null> {
    const [organization] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        mission: organizations.mission,
        sharedTools: organizations.sharedTools,
        sharedServers: organizations.sharedServers,
        createdAt: organizations.createdAt,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId.value))
      .limit(1);

    return organization || null;
  }

  async getTableData(organizationId: OrganizationId): Promise<TableData[]> {
    const tablesData = await this.db
      .select({
        id: tables.id,
        name: tables.name,
        dbName: tables.dbName,
        databaseId: tables.databaseId,
        metadata: tables.metadata,
        organizationId: tables.organizationId,
        databaseName: databases.name,
        databaseSlug: databases.slug,
      })
      .from(tables)
      .leftJoin(databases, eq(tables.databaseId, databases.id))
      .where(eq(tables.organizationId, organizationId.value));

    // Get fields for each table
    const tablesWithFields = await Promise.all(
      tablesData.map(async (table) => {
        const tableFields = await this.db
          .select()
          .from(fields)
          .where(eq(fields.tableId, table.id));

        return {
          ...table,
          fields: tableFields.map(field => ({
            id: field.id,
            tableId: field.tableId,
            name: field.name,
            slug: field.slug,
            type: field.type,
            orderIndex: field.orderIndex ?? 0, // Default to 0 if null
            relatedTableId: field.relatedTableId,
            required: field.required ?? false, // Default to false if null
            createdAt: field.createdAt ?? new Date() // Default to current date if null
          }))
        };
      })
    );

    return tablesWithFields;
  }

  async getDatabaseData(organizationId: OrganizationId): Promise<DatabaseData[]> {
    const databasesData = await this.db
      .select({
        id: databases.id,
        name: databases.name,
        slug: databases.slug,
        metadata: databases.metadata,
        organizationId: databases.organizationId,
      })
      .from(databases)
      .where(eq(databases.organizationId, organizationId.value));

    return databasesData;
  }

  async getAgentData(organizationId: OrganizationId): Promise<AgentData[]> {
    const agentsData = await this.db
      .select({
        id: agents.id,
        name: agents.name,
        role: agents.role,
        description: agents.description,
        persona: agents.persona,
        tools: agents.tools,
        servers: agents.servers,
        capabilities: agents.capabilities,
        status: agents.status,
        createdAt: agents.createdAt,
      })
      .from(agents)
      .where(eq(agents.organizationId, organizationId.value));

    return agentsData;
  }

  async getTeamData(organizationId: OrganizationId): Promise<TeamData[]> {
    const teamsData = await this.db
      .select()
      .from(teams)
      .where(eq(teams.organizationId, organizationId.value));

    return teamsData;
  }

  async getFileData(organizationId: OrganizationId): Promise<FileData[]> {
    // Get all file fields from tables in this organization
    const fileFieldsQuery = await this.db.execute(sql`
      SELECT DISTINCT 
        f.id as field_id,
        f.name as field_name, 
        f.slug as field_slug,
        t.id as table_id,
        t.name as table_name,
        t.db_name as table_db_name,
        d.name as database_name
      FROM fields f
      JOIN tables t ON f.table_id = t.id  
      JOIN databases d ON t.database_id = d.id
      WHERE f.type = 'file' 
      AND t.organization_id = ${organizationId.value}
    `);

    const allFileData: FileData[] = [];

    for (const field of fileFieldsQuery) {
      try {
        // Cast the raw SQL field results to expected types
        const fieldData = field as any;
        const fieldId = Number(fieldData.field_id);
        const fieldName = String(fieldData.field_name);
        const tableId = Number(fieldData.table_id);
        const tableName = String(fieldData.table_name);
        const tableDbName = String(fieldData.table_db_name);
        const databaseName = String(fieldData.database_name);

        // Get all rows with files in this field
        const rows = await this.db.execute(sql`
          SELECT id, ${sql.raw(`field_${fieldId}`)} as file_data, created_at, updated_at
          FROM ${sql.raw(tableDbName)} 
          WHERE ${sql.raw(`field_${fieldId}`)} IS NOT NULL
          AND ${sql.raw(`field_${fieldId}`)} != '[]'
        `);

        for (const row of rows) {
          try {
            const fileData = typeof row.file_data === 'string' 
              ? JSON.parse(row.file_data) 
              : row.file_data;
            
            if (Array.isArray(fileData)) {
              for (const file of fileData) {
                allFileData.push({
                  id: file.id,
                  name: file.name,
                  size: file.size,
                  mimeType: file.mimeType,
                  s3Key: file.s3Key,
                  uploadedAt: new Date(file.uploadedAt),
                  tableId: tableId,
                  tableName: tableName,
                  databaseName: databaseName,
                  fieldId: fieldId,
                  fieldName: fieldName
                });
              }
            }
          } catch (error) {
            console.error(`[ORG-DATA-REPO] Error processing row files:`, error);
          }
        }
      } catch (error) {
        console.error(`[ORG-DATA-REPO] Error processing field:`, error);
      }
    }

    return allFileData;
  }

  async getDataForDomainTypes(
    organizationId: OrganizationId, 
    domainTypes: DomainType[]
  ): Promise<{
    organizations?: OrganizationData[];
    tables?: TableData[];
    databases?: DatabaseData[];
    agents?: AgentData[];
    teams?: TeamData[];
    files?: FileData[];
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
          console.warn(`[ORG-DATA-REPO] Unsupported domain type: ${domainType}`);
      }
    }

    return result;
  }

  async getDataCounts(organizationId: OrganizationId): Promise<Record<DomainType, number>> {
    const [tableCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(tables)
      .where(eq(tables.organizationId, organizationId.value));

    const [agentCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(agents)
      .where(eq(agents.organizationId, organizationId.value));

    const [databaseCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(databases)
      .where(eq(databases.organizationId, organizationId.value));

    const [teamCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(teams)
      .where(eq(teams.organizationId, organizationId.value));

    // File count requires more complex query
    const fileCountQuery = await this.db.execute(sql`
      SELECT COUNT(*) as count
      FROM fields f
      JOIN tables t ON f.table_id = t.id
      WHERE f.type = 'file' 
      AND t.organization_id = ${organizationId.value}
    `);
    const fileCount = fileCountQuery[0]?.count || 0;

    return {
      organization: 1, // Always 1 for the organization itself
      table: tableCount.count,
      database: databaseCount.count,
      agent: agentCount.count,
      team: teamCount.count,
      file: Number(fileCount)
    };
  }
}