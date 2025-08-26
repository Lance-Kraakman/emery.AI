// AIDEV-NOTE: Domain service for RAG indexing operations
// Contains core business logic for indexing different data types

import { RagDocument, type DocumentMetadata } from '../entities';
import { RagIndexId, OrganizationId, type DomainType } from '../value-objects';

export interface IndexingResult {
  documentsProcessed: number;
  documentsAdded: number;
  documentsUpdated: number;
  documentsDeleted: number;
  errors: string[];
}

// Import domain entities directly 
import type { Organization } from '@/ddd/domain/organizations/entities/organization';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Agent } from '@/ddd/domain/agents/entities/agent';
import { getCapabilitiesCount } from '@/ddd/domain/agents/entities/agent';
import type { Database } from '@/ddd/domain/databases/entities/database';
import type { Team } from '@/ddd/domain/teams/entities/team';
import type { Field } from '@/ddd/domain/fields/entities/field';
import type { StoredFile } from '@/ddd/domain/files/entities/file-storage';

// Import content processing interfaces
import { 
  type ContentProcessor, 
  type ProcessedContent 
} from './content-processor';

export class IndexingDomainService {
  constructor(
    private readonly contentProcessor: ContentProcessor
  ) {}

  /**
   * Index organization data for a RAG index
   */
  async indexOrganizationData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    organization: Organization
  ): Promise<RagDocument[]> {
    const content = this.generateOrganizationContent(organization);
    const embedding = await this.contentProcessor.generateEmbedding(content);
    const contentHash = this.contentProcessor.calculateContentHash(content);

    const document = RagDocument.create({
      indexId,
      organizationId,
      sourceId: organization.id.toString(),
      domainType: 'organization',
      sourceName: organization.name.value,
      title: `Organization: ${organization.name.value}`,
      content,
      metadata: {
        organizationId: organization.id,
        sharedToolsCount: organization.sharedTools?.length || 0,
        sharedServersCount: organization.sharedServers?.length || 0,
        createdAt: organization.createdAt,
      },
      embedding,
      contentHash,
    });

    return [document];
  }

  /**
   * Index table data for a RAG index
   */
  async indexTableData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    tables: DynamicTable[],
    fieldsMap?: Map<number, Field[]>,
    databasesMap?: Map<number, Database>
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const table of tables) {
      const fields = fieldsMap?.get(table.id) || [];
      const content = this.generateTableSchemaContent(table, fields, databasesMap);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: table.id.toString(),
        domainType: 'table',
        sourceName: table.name,
        title: `Table: ${table.name}`,
        content,
        metadata: {
          tableId: table.id,
          tableName: table.name,
          databaseId: table.databaseId,
          tableMetadata: table.metadata,
          organizationId: table.organizationId,
          fieldCount: fields.length,
        },
        embedding,
        contentHash,
      });

      documents.push(document);
    }

    return documents;
  }

  /**
   * Index file data for a RAG index
   */
  async indexFileData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    files: StoredFile[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const file of files) {
      try {
        const processedChunks = await this.contentProcessor.processFileContent(file);

        for (let chunkIndex = 0; chunkIndex < processedChunks.length; chunkIndex++) {
          const chunk = processedChunks[chunkIndex];
          
          const document = RagDocument.create({
            indexId,
            organizationId,
            sourceId: `${file.key}-chunk-${chunkIndex}`,
            domainType: 'file',
            sourceName: file.name,
            title: `File: ${file.name} (Chunk ${chunkIndex + 1}/${processedChunks.length})`,
            content: chunk.content,
            metadata: {
              ...chunk.metadata,
              fileKey: file.key,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.mimeType,
              chunkIndex: chunkIndex,
              totalChunks: processedChunks.length,
              uploadedAt: file.uploadedAt,
              organizationId: organizationId.value,
              processingMethod: 'llamaindex'
            },
            embedding: chunk.embedding,
            contentHash: chunk.contentHash,
          });

          documents.push(document);
        }
      } catch (error) {
        console.error(`[INDEXING-DOMAIN] Error processing file ${file.name}:`, error);
        // Continue with other files
      }
    }

    return documents;
  }

  /**
   * Index agent data for a RAG index
   */
  async indexAgentData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    agents: Agent[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const agent of agents) {
      const content = this.generateAgentContent(agent);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: agent.id.toString(),
        domainType: 'agent',
        sourceName: agent.name,
        title: `Agent: ${agent.name}`,
        content,
        metadata: {
          agentId: agent.id,
          role: agent.role,
          status: agent.status,
          organizationId: organizationId.value,
          toolCount: agent.tools ? Object.keys(agent.tools).length : 0,
          serverCount: agent.servers ? Object.keys(agent.servers).length : 0,
          capabilityCount: getCapabilitiesCount(agent),
        },
        embedding,
        contentHash,
      });

      documents.push(document);
    }

    return documents;
  }

  /**
   * Index database data for a RAG index
   */
  async indexDatabaseData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    databases: Database[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const database of databases) {
      const content = this.generateDatabaseContent(database);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: database.id.toString(),
        domainType: 'database',
        sourceName: database.name,
        title: `Database: ${database.name}`,
        content,
        metadata: {
          databaseId: database.id,
          slug: database.slug,
          databaseMetadata: database.metadata,
          organizationId: database.organizationId,
        },
        embedding,
        contentHash,
      });

      documents.push(document);
    }

    return documents;
  }

  /**
   * Index team data for a RAG index
   */
  async indexTeamData(
    indexId: RagIndexId,
    organizationId: OrganizationId,
    teams: Team[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const team of teams) {
      const content = this.generateTeamContent(team);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: team.id.toString(),
        domainType: 'team',
        sourceName: team.name,
        title: `Team: ${team.name}`,
        content,
        metadata: {
          teamId: team.id,
          organizationId: organizationId.value,
          agentCount: team.agentCount,
        },
        embedding,
        contentHash,
      });

      documents.push(document);
    }

    return documents;
  }

  // Content generation methods (moved from existing service)
  private generateOrganizationContent(organization: Organization): string {
    const toolsList = organization.sharedTools && organization.sharedTools.length > 0
      ? `\nShared Tools:\n${organization.sharedTools.map(tool => `- ${tool}`).join('\n')}`
      : '\nShared Tools: None configured';

    const serversList = organization.sharedServers && organization.sharedServers.length > 0
      ? `\nShared Servers:\n${organization.sharedServers.map(server => `- ${server}`).join('\n')}`
      : '\nShared Servers: None configured';

    const createdDate = organization.createdAt 
      ? `\nEstablished: ${organization.createdAt.toLocaleDateString()}`
      : '';

    return `Organization: ${organization.name}
${organization.mission ? `Mission: ${organization.mission}` : 'Mission: Not specified'}${createdDate}${toolsList}${serversList}

About: ${organization.name} is an active organization on the Emery platform, which provides dynamic database management, workflow automation, and team collaboration capabilities. This organization can create tables, manage data, build workflows with agents, and coordinate team activities using shared resources and tools.

Capabilities: The organization has access to Emery's full feature set including dynamic table creation, field management, data operations, agent-powered workflows, team collaboration, role-based access control, and integration with external services through shared tools and servers.`;
  }

  private generateTableSchemaContent(table: DynamicTable, fields: Field[], databasesMap?: Map<number, Database>): string {
    const fieldsDescription = fields.map(field => {
      let desc = `- ${field.name} (${field.type})`;
      if (field.required) desc += ' *required*';
      if (field.relatedTableId) {
        desc += ` → relates to table ID ${field.relatedTableId} (relationship field for cross-table data connections)`;
      }
      if (field.type === 'file') {
        desc += ' → stores uploaded files (documents, spreadsheets, images, etc.)';
      }
      return desc;
    }).join('\n');

    const fieldTypes = fields.reduce((acc, field) => {
      acc[field.type] = (acc[field.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const fieldTypeSummary = Object.entries(fieldTypes)
      .map(([type, count]) => `${count} ${type} field${(count as number) > 1 ? 's' : ''}`)
      .join(', ');

    const description = table.metadata?.description 
      ? `\nDescription: ${table.metadata.description}` 
      : '';

    const database = databasesMap?.get(table.databaseId);
    const databaseName = database?.name || `Database ID ${table.databaseId}`;

    const relationshipFields = fields.filter(f => f.relatedTableId);
    const fileFields = fields.filter(f => f.type === 'file');

    let relationshipContext = '';
    if (relationshipFields.length > 0) {
      relationshipContext = `\nRelationships: This table connects to other tables through ${relationshipFields.length} relationship field${relationshipFields.length > 1 ? 's' : ''}: ${relationshipFields.map((f: any) => f.name).join(', ')}`;
    }

    let fileContext = '';
    if (fileFields.length > 0) {
      fileContext = `\nFile Storage: This table can store files in ${fileFields.length} field${fileFields.length > 1 ? 's' : ''}: ${fileFields.map((f: any) => f.name).join(', ')}. These files are uploaded documents, spreadsheets, images, or other data that belong to records in this table.`;
    }

    return `Table: ${table.name}
Database: ${databaseName}
Purpose: Structured data storage and workflow operations${description}

Schema Overview: ${fieldTypeSummary} (${fields.length} total fields)
${fieldsDescription}${relationshipContext}${fileContext}

Data Context: This table is part of the "${databaseName}" database and contains structured data for the organization. Records in this table may have relationships to other tables and can include uploaded files that contain additional data or documentation.

Usage: This table supports data analysis, reporting, workflow automation, and integration with other Emery systems. The dynamic schema allows for flexible data operations while maintaining type safety and relationships.`;
  }

  private generateAgentContent(agent: Agent): string {
    const toolsList = agent.tools && typeof agent.tools === 'object'
      ? `\nTools: ${Object.keys(agent.tools).join(', ')}`
      : '\nTools: None configured';

    const serversList = agent.servers && typeof agent.servers === 'object'
      ? `\nServers: ${Object.keys(agent.servers).join(', ')}`
      : '\nServers: None configured';

    const capabilityCount = getCapabilitiesCount(agent);
    const capabilitiesDesc = capabilityCount > 0
      ? `\nCapabilities: ${capabilityCount} configured capabilities`
      : '\nCapabilities: None configured';

    const createdDate = agent.createdAt 
      ? `\nCreated: ${agent.createdAt.toLocaleDateString()}`
      : '';

    return `Agent: ${agent.name}
${agent.role ? `Role: ${agent.role}` : 'Role: Not specified'}
${agent.description ? `Description: ${agent.description}` : 'Description: Not provided'}
${agent.persona ? `Persona: ${agent.persona}` : 'Persona: Default assistant'}
Status: ${agent.status || 'active'}${createdDate}${toolsList}${serversList}${capabilitiesDesc}

About: ${agent.name} is an AI agent configured within the Emery platform for workflow automation and task execution. This agent can process requests, execute workflows, and integrate with various tools and services to accomplish organizational objectives.

Functionality: The agent operates within the Emery ecosystem to handle automated workflows, data processing, integration tasks, and other organizational processes as configured through its capabilities and available tools.`;
  }

  private generateDatabaseContent(database: Database): string {
    const description = database.description
      ? `\nDescription: ${database.description}`
      : '';

    return `Database: ${database.name}
Slug: ${database.slug}
Organization: ${database.organizationId}${description}

Purpose: This database organizes related tables and data for the organization. It provides logical grouping of tables that share common purposes or domains within the Emery platform.

Capabilities: The database supports dynamic table creation, field management, data operations, and integration with workflow automation. Tables within this database can be used for data analysis, reporting, and agent-powered workflows.

Context: This is a database within the Emery platform, which provides dynamic database management, workflow automation, and team collaboration capabilities.`;
  }

  private generateTeamContent(team: Team): string {
    const responsibilitiesList = team.responsibilities && team.responsibilities.length > 0
      ? `\nResponsibilities:\n${team.responsibilities.map(r => `- ${r}`).join('\n')}`
      : '\nResponsibilities: Not specified';

    const goalsList = team.goals && team.goals.length > 0
      ? `\nGoals:\n${team.goals.map(g => `- ${g}`).join('\n')}`
      : '\nGoals: Not specified';

    const agentIdsList = team.agentIds && team.agentIds.length > 0
      ? `\nAssociated Agent IDs: ${team.agentIds.join(', ')}`
      : '\nAssociated Agent IDs: None';

    const createdDate = team.createdAt
      ? `\nCreated: ${team.createdAt.toLocaleDateString()}`
      : '';

    return `Team: ${team.name}
${team.purpose ? `Purpose: ${team.purpose}` : 'Purpose: Not specified'}
${team.description ? `Description: ${team.description}` : 'Description: Not provided'}${createdDate}${responsibilitiesList}${goalsList}${agentIdsList}

About: ${team.name} is a team within the organization, responsible for specific functions and objectives. This team may utilize AI agents to automate tasks and achieve its goals.

Functionality: The team collaborates on tasks, projects, and workflows within the Emery platform. Its activities are aligned with its defined purpose and responsibilities, contributing to the overall mission of the organization.`;
  }
}