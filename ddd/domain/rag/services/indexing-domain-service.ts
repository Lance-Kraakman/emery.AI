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

// Import data types from repository interfaces
import {
  type TableData,
  type FileData,
  type AgentData,
  type OrganizationData,
  type DatabaseData,
  type TeamData
} from '../repositories';

export interface ProcessedContent {
  content: string;
  metadata: DocumentMetadata;
  embedding: number[];
  contentHash: string;
}

export interface ContentProcessor {
  /**
   * Generate embeddings for text content
   */
  generateEmbedding(content: string): Promise<number[]>;

  /**
   * Calculate content hash for deduplication
   */
  calculateContentHash(content: string): string;

  /**
   * Process file content with LlamaIndex
   */
  processFileContent(fileData: FileData): Promise<ProcessedContent[]>;
}

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
    organizationData: OrganizationData
  ): Promise<RagDocument[]> {
    const content = this.generateOrganizationContent(organizationData);
    const embedding = await this.contentProcessor.generateEmbedding(content);
    const contentHash = this.contentProcessor.calculateContentHash(content);

    const document = RagDocument.create({
      indexId,
      organizationId,
      sourceId: organizationData.id.toString(),
      domainType: 'organization',
      sourceName: organizationData.name,
      title: `Organization: ${organizationData.name}`,
      content,
      metadata: {
        organizationId: organizationData.id,
        sharedToolsCount: organizationData.sharedTools?.length || 0,
        sharedServersCount: organizationData.sharedServers?.length || 0,
        createdAt: organizationData.createdAt,
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
    tablesData: TableData[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const tableData of tablesData) {
      const content = this.generateTableSchemaContent(tableData, tableData.fields || []);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: tableData.id.toString(),
        domainType: 'table',
        sourceName: tableData.name,
        title: `Table: ${tableData.name} (Database: ${tableData.databaseName || 'Unknown'})`,
        content,
        metadata: {
          tableId: tableData.id,
          tableName: tableData.name,
          databaseId: tableData.databaseId,
          databaseName: tableData.databaseName,
          databaseSlug: tableData.databaseSlug,
          tableMetadata: tableData.metadata,
          organizationId: tableData.organizationId,
          fieldCount: tableData.fields?.length || 0,
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
    filesData: FileData[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const fileData of filesData) {
      try {
        const processedChunks = await this.contentProcessor.processFileContent(fileData);

        for (let chunkIndex = 0; chunkIndex < processedChunks.length; chunkIndex++) {
          const chunk = processedChunks[chunkIndex];
          
          const document = RagDocument.create({
            indexId,
            organizationId,
            sourceId: `${fileData.id}-chunk-${chunkIndex}`,
            domainType: 'file',
            sourceName: fileData.name,
            title: `File: ${fileData.name} (Chunk ${chunkIndex + 1}/${processedChunks.length}) - ${fileData.databaseName} → ${fileData.tableName} → ${fileData.fieldName}`,
            content: chunk.content,
            metadata: {
              ...chunk.metadata,
              fileId: fileData.id,
              fileName: fileData.name,
              fileSize: fileData.size,
              mimeType: fileData.mimeType,
              chunkIndex: chunkIndex,
              totalChunks: processedChunks.length,
              tableId: fileData.tableId,
              tableName: fileData.tableName,
              databaseName: fileData.databaseName,
              fieldId: fileData.fieldId,
              fieldName: fileData.fieldName,
              uploadedAt: fileData.uploadedAt,
              organizationId: organizationId.value,
              contextPath: `${fileData.databaseName} → ${fileData.tableName} → ${fileData.fieldName}`,
              processingMethod: 'llamaindex'
            },
            embedding: chunk.embedding,
            contentHash: chunk.contentHash,
          });

          documents.push(document);
        }
      } catch (error) {
        console.error(`[INDEXING-DOMAIN] Error processing file ${fileData.name}:`, error);
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
    agentsData: AgentData[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const agentData of agentsData) {
      const content = this.generateAgentContent(agentData);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: agentData.id.toString(),
        domainType: 'agent',
        sourceName: agentData.name,
        title: `Agent: ${agentData.name}`,
        content,
        metadata: {
          agentId: agentData.id,
          role: agentData.role,
          status: agentData.status,
          organizationId: organizationId.value,
          toolCount: Array.isArray(agentData.tools) ? agentData.tools.length : 0,
          serverCount: Array.isArray(agentData.servers) ? agentData.servers.length : 0,
          capabilityCount: Array.isArray(agentData.capabilities) ? agentData.capabilities.length : 0,
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
    databasesData: DatabaseData[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const databaseData of databasesData) {
      const content = this.generateDatabaseContent(databaseData);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: databaseData.id.toString(),
        domainType: 'database',
        sourceName: databaseData.name,
        title: `Database: ${databaseData.name}`,
        content,
        metadata: {
          databaseId: databaseData.id,
          slug: databaseData.slug,
          databaseMetadata: databaseData.metadata,
          organizationId: databaseData.organizationId,
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
    teamsData: TeamData[]
  ): Promise<RagDocument[]> {
    const documents: RagDocument[] = [];

    for (const teamData of teamsData) {
      const content = this.generateTeamContent(teamData);
      const embedding = await this.contentProcessor.generateEmbedding(content);
      const contentHash = this.contentProcessor.calculateContentHash(content);

      const document = RagDocument.create({
        indexId,
        organizationId,
        sourceId: teamData.id.toString(),
        domainType: 'team',
        sourceName: teamData.name,
        title: `Team: ${teamData.name}`,
        content,
        metadata: {
          teamId: teamData.id,
          organizationId: organizationId.value,
          agentCount: Array.isArray(teamData.agentIds) ? teamData.agentIds.length : 0,
        },
        embedding,
        contentHash,
      });

      documents.push(document);
    }

    return documents;
  }

  // Content generation methods (moved from existing service)
  private generateOrganizationContent(organization: OrganizationData): string {
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

  private generateTableSchemaContent(table: TableData, fields: any[]): string {
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

    const databaseName = table.databaseName || 'Unknown Database';

    const relationshipFields = fields.filter(f => f.relatedTableId);
    const fileFields = fields.filter(f => f.type === 'file');

    let relationshipContext = '';
    if (relationshipFields.length > 0) {
      relationshipContext = `\nRelationships: This table connects to other tables through ${relationshipFields.length} relationship field${relationshipFields.length > 1 ? 's' : ''}: ${relationshipFields.map(f => f.name).join(', ')}`;
    }

    let fileContext = '';
    if (fileFields.length > 0) {
      fileContext = `\nFile Storage: This table can store files in ${fileFields.length} field${fileFields.length > 1 ? 's' : ''}: ${fileFields.map(f => f.name).join(', ')}. These files are uploaded documents, spreadsheets, images, or other data that belong to records in this table.`;
    }

    return `Table: ${table.name}
Database: ${databaseName}
Purpose: Structured data storage and workflow operations${description}

Schema Overview: ${fieldTypeSummary} (${fields.length} total fields)
${fieldsDescription}${relationshipContext}${fileContext}

Data Context: This table is part of the "${databaseName}" database and contains structured data for the organization. Records in this table may have relationships to other tables and can include uploaded files that contain additional data or documentation.

Usage: This table supports data analysis, reporting, workflow automation, and integration with other Emery systems. The dynamic schema allows for flexible data operations while maintaining type safety and relationships.`;
  }

  private generateAgentContent(agent: AgentData): string {
    const toolsList = agent.tools && Array.isArray(agent.tools) && agent.tools.length > 0
      ? `\nTools: ${agent.tools.map((tool: any) => typeof tool === 'string' ? tool : tool.name || 'Unknown').join(', ')}`
      : '\nTools: None configured';

    const serversList = agent.servers && Array.isArray(agent.servers) && agent.servers.length > 0
      ? `\nServers: ${agent.servers.map((server: any) => typeof server === 'string' ? server : server.name || 'Unknown').join(', ')}`
      : '\nServers: None configured';

    const capabilitiesDesc = agent.capabilities && Array.isArray(agent.capabilities) && agent.capabilities.length > 0
      ? `\nCapabilities: ${agent.capabilities.length} configured capabilities including ${agent.capabilities.map((cap: any) => cap.name || 'unnamed capability').join(', ')}`
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

  private generateDatabaseContent(database: DatabaseData): string {
    const description = database.metadata?.description
      ? `\nDescription: ${database.metadata.description}`
      : '';

    return `Database: ${database.name}
Slug: ${database.slug}
Organization: ${database.organizationId}${description}

Purpose: This database organizes related tables and data for the organization. It provides logical grouping of tables that share common purposes or domains within the Emery platform.

Capabilities: The database supports dynamic table creation, field management, data operations, and integration with workflow automation. Tables within this database can be used for data analysis, reporting, and agent-powered workflows.

Context: This is a database within the Emery platform, which provides dynamic database management, workflow automation, and team collaboration capabilities.`;
  }

  private generateTeamContent(team: TeamData): string {
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