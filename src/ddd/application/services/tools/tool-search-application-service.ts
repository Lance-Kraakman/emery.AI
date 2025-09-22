/**
 * Tool Search Application Service
 *
 * Unified search across all tool types:
 * 1. Reference tools (agents, tables, documents, files, databases)
 * 2. Hardcoded tools (from tool registry)
 *
 * AIDEV-NOTE: Renamed from ReferenceApplicationService with broader scope.
 * Now searches both reference data AND hardcoded tools for @ mentions.
 */

import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { Reference } from '@/ddd/domain/chat/value-objects/reference';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';
import { ReferenceTool } from '@/ddd/domain/tools/entities/reference-tool';
import { Tool } from '@/ddd/domain/tools/entities/tool';
import { ToolCategory } from '@/ddd/domain/tools/value-objects/tool-metadata';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import type { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import { RowMapper, type DocumentFieldValue, type FileFieldValue } from '@/app/mappers/row-mapper';
import { isDocumentArray, isFileArray } from '@/ddd/domain/tables/value-objects/field-values';
import type { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';

export interface SearchReferencesOptions {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
  organizationId: OrganizationId;
}

/**
 * Enhanced search result with ReferenceTool objects
 */
export interface SearchReferenceToolsResult {
  referenceTools: ReferenceTool[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * Complete tool search result with both reference and system tools
 */
export interface SearchToolsResult {
  referenceTools: ReferenceTool[];  // Data references (agents, docs, files, tables, databases)
  systemTools: Tool[];              // Execution tools (python_repl, web_search, etc.)
  hasMore: boolean;
  totalCount: number;
}

export class ToolSearchApplicationService {
  constructor(
    private readonly tableApplicationService: TableApplicationService,
    private readonly agentApplicationService: AgentApplicationService,
    private readonly databaseApplicationService: DatabaseApplicationService,
    private readonly toolRegistryService: IToolRegistryService
  ) {}

  /**
   * Complete search that returns both reference tools and system tools
   * This is the new recommended method for tool search
   */
  async searchAllTools(options: SearchReferencesOptions): Promise<SearchToolsResult> {
    const { query, categories, limit = 20, offset = 0, organizationId } = options;

    console.log(`[ToolSearchService] Searching for query: "${query}", categories:`, categories);

    // Search both reference tools and system tools in parallel
    const [referenceToolsResult, systemTools] = await Promise.all([
      this.searchOnlyReferenceTools(options),
      this.searchSystemTools(query, categories)
    ]);

    console.log(`[ToolSearchService] Found ${referenceToolsResult.referenceTools.length} reference tools, ${systemTools.length} system tools`);

    // Apply pagination to combined results
    const allTools = [
      ...referenceToolsResult.referenceTools,
      ...systemTools
    ];

    // Sort by relevance
    const sortedReferenceTools = this.sortReferenceToolsByRelevance(referenceToolsResult.referenceTools, query);
    const sortedSystemTools = this.sortSystemToolsByRelevance(systemTools, query);

    // Apply pagination
    const paginatedReferenceTools = sortedReferenceTools.slice(offset, Math.min(offset + limit, sortedReferenceTools.length));
    const remainingLimit = limit - paginatedReferenceTools.length;
    const paginatedSystemTools = remainingLimit > 0 ? sortedSystemTools.slice(0, remainingLimit) : [];

    const totalItems = sortedReferenceTools.length + sortedSystemTools.length;
    const hasMore = offset + limit < totalItems;

    return {
      referenceTools: paginatedReferenceTools,
      systemTools: paginatedSystemTools,
      hasMore,
      totalCount: totalItems
    };
  }

  /**
   * Search only reference tools (agents, docs, files, tables, databases)
   */
  async searchReferenceTools(options: SearchReferencesOptions): Promise<SearchReferenceToolsResult> {
    return this.searchOnlyReferenceTools(options);
  }

  /**
   * Search only reference tools (original behavior)
   */
  private async searchOnlyReferenceTools(options: SearchReferencesOptions): Promise<SearchReferenceToolsResult> {
    const { query, categories, limit = 20, offset = 0, organizationId } = options;

    // Determine what categories to search based on query pattern
    const searchCategories = this.determineSearchCategories(query, categories);

    // Execute searches in parallel for better performance
    const searchPromises = searchCategories.map(category =>
      this.searchToolsByCategory(category, query, organizationId, limit, offset)
    );

    const categoryResults = await Promise.all(searchPromises);

    // Combine results
    const allReferenceTools = categoryResults.flat();

    return {
      referenceTools: allReferenceTools,
      hasMore: false, // Will be calculated at the top level
      totalCount: allReferenceTools.length
    };
  }

  /**
   * Search system tools using the existing tool registry service
   * These are execution tools like python_repl, web_search, OAuth tools, etc.
   * Returns proper Tool instances following DDD patterns
   */
  private async searchSystemTools(
    query: string,
    categories: ReferenceCategory[] | undefined
  ): Promise<Tool[]> {
    console.log(`[ToolSearchService] Searching system tools for: "${query}"`);

    try {
      // Use the existing tool registry service to search tools
      const toolMetadataList = await this.toolRegistryService.searchTools(query, 20);
      console.log(`[ToolSearchService] Found ${toolMetadataList.length} tool metadata entries`);

      // Convert ToolMetadata to Tool instances
      const tools = toolMetadataList.map(metadata =>
        this.toolRegistryService.createTool(metadata)
      );

      console.log(`[ToolSearchService] Created ${tools.length} system tools`);

      return tools;
    } catch (error) {
      console.error(`[ToolSearchService] Error searching system tools:`, error);
      return [];
    }
  }



  /**
   * Determine which categories to search based on query pattern
   */
  private determineSearchCategories(
    query: string, 
    explicitCategories?: ('doc' | 'file' | 'agent' | 'table' | 'database')[]
  ): ('doc' | 'file' | 'agent' | 'table' | 'database')[] {
    if (explicitCategories) {
      return explicitCategories;
    }

    // Auto-detect based on query pattern
    const cleanQuery = query.trim().toLowerCase();
    
    if (cleanQuery.startsWith('@doc:') || cleanQuery.startsWith('@file:')) {
      return ['doc', 'file'];
    } else if (cleanQuery.startsWith('@agent:')) {
      return ['agent'];
    } else if (cleanQuery.startsWith('@table:')) {
      return ['table'];
    } else if (cleanQuery.startsWith('@database:')) {
      return ['database'];
    } else if (cleanQuery === '@' || cleanQuery === '') {
      // Search all categories when just @ or empty
      return ['doc', 'file', 'agent', 'table', 'database'];
    }
    
    // Default to documents and agents for partial queries
    return ['doc', 'file', 'agent'];
  }

  /**
   * Search within a specific category returning ReferenceTool objects
   */
  private async searchToolsByCategory(
    category: 'doc' | 'file' | 'agent' | 'table' | 'database',
    query: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const searchText = this.extractSearchText(query);

    try {
      switch (category) {
        case 'agent':
          return await this.searchAgentTools(searchText, organizationId, limit, offset);

        case 'table':
          return await this.searchTableTools(searchText, organizationId, limit, offset);

        case 'database':
          return await this.searchDatabaseTools(searchText, organizationId, limit, offset);

        case 'doc':
        case 'file':
          return await this.searchDocumentTools(searchText, organizationId, limit, offset);

        default:
          return [];
      }
    } catch (error) {
      console.error(`Error searching ${category} tools:`, error);
      return [];
    }
  }


  /**
   * Search agents returning ReferenceTool objects
   */
  private async searchAgentTools(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const agents = await this.agentApplicationService.getAgents({
      organizationId,
      searchQuery: searchText,
      status: 'active'
    });

    // Apply pagination manually since AgentApplicationService doesn't support offset
    const paginatedAgents = agents.slice(offset, offset + limit);

    return paginatedAgents.map(agent => {
      return ReferenceTool.fromAgent(
        agent.id.value,
        organizationId.value,
        agent.ownerId.value,
        agent.name,
        `${agent.role || 'Agent'} - ${agent.description || 'No description'}`
      );
    });
  }


  /**
   * Search tables returning ReferenceTool objects
   */
  private async searchTableTools(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    const allTableTools: ReferenceTool[] = [];

    // Search through all tables in all databases
    const allOrgTables = await this.tableApplicationService.getTablesForOrganization(organizationId);

    for (const database of databases) {
      const tables = allOrgTables.filter(table => table.databaseId.equals(database.id));

      const matchingTables = tables
        .filter(table =>
          !searchText ||
          table.name.toLowerCase().includes(searchText.toLowerCase()) ||
          table.description?.toLowerCase().includes(searchText.toLowerCase())
        )
        .map(table => {
          return ReferenceTool.fromTable(
            table.id.value.toString(),
            organizationId.value,
            table.name,
            database.name,
            `Table in ${database.name} - ${table.description || 'No description'}`
          );
        });

      allTableTools.push(...matchingTables);
    }

    // Apply pagination
    return allTableTools.slice(offset, offset + limit);
  }


  /**
   * Search databases returning ReferenceTool objects
   */
  private async searchDatabaseTools(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });

    const matchingDatabases = databases
      .filter(database =>
        !searchText ||
        database.name.toLowerCase().includes(searchText.toLowerCase()) ||
        database.description?.toLowerCase().includes(searchText.toLowerCase())
      )
      .slice(offset, offset + limit)
      .map(database => {
        return ReferenceTool.fromDatabase(
          database.id.value.toString(),
          organizationId.value,
          database.name,
          `Database - ${database.description || 'No description'}`
        );
      });

    return matchingDatabases;
  }


  /**
   * Search documents/files returning ReferenceTool objects
   */
  private async searchDocumentTools(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    const allDocumentTools: ReferenceTool[] = [];

    // Search through all tables for document-like content
    const allOrgTables = await this.tableApplicationService.getTablesForOrganization(organizationId);

    for (const database of databases) {
      const tables = allOrgTables.filter(table => table.databaseId.equals(database.id));

      for (const table of tables) {
        try {
          // Get table fields to map fieldSlug to fieldId
          const tableFields = await this.tableApplicationService.getFieldsForTable(table.id);

          // Skip tables without document or file fields
          const documentFields = tableFields.filter(field => field.type === 'document' || field.type === 'file');
          if (documentFields.length === 0) continue;

          // Map field name (slug) to fieldId - the FieldValue.fieldSlug is the field name, not column name
          const fieldSlugToIdMap = new Map(
            tableFields.map(field => [field.name, field.id.value])
          );

          // Use TableApplicationService.getRows with proper pagination
          const queryOptions: RowQueryOptions = {
            limit: limit * 2, // Get more rows since we'll filter by document/file names
            offset,
            orderBy: 'created_at',
            orderDirection: 'DESC'
          };

          const rows = await this.tableApplicationService.getRows(table.id, queryOptions);

          if (rows && rows.length > 0) {
            // Process each row using RowMapper to get properly typed field values
            for (const row of rows) {
              const rowDTO = RowMapper.toDTO(row);

              // Look through all field values to find document and file fields
              for (const fieldValue of rowDTO.fieldValues) {
                const fieldId = fieldSlugToIdMap.get(fieldValue.fieldSlug);
                if (!fieldId) continue; // Skip if we can't find the fieldId

                if (fieldValue.fieldType === 'document' && fieldValue.value && isDocumentArray(fieldValue.value)) {
                  // Handle DocumentArrayFieldValue - iterate through each document
                  const docArray = fieldValue.value as DocumentFieldValue[];
                  for (const docField of docArray) {
                    const title = docField.documentMetadata?.title || docField.name || 'Untitled Document';

                    // Filter by search text if provided
                    if (!searchText || title.toLowerCase().includes(searchText.toLowerCase())) {
                      allDocumentTools.push(
                        ReferenceTool.fromDocument(
                          docField.id,
                          organizationId.value,
                          title,
                          docField.mimeType || 'application/octet-stream',
                          table.name,
                          table.id.value,
                          fieldId,
                          rowDTO.id,
                          database.name
                        )
                      );
                    }
                  }
                } else if (fieldValue.fieldType === 'file' && fieldValue.value && isFileArray(fieldValue.value)) {
                  // Handle FileArrayFieldValue - iterate through each file
                  const fileArray = fieldValue.value as FileFieldValue[];
                  for (const fileField of fileArray) {
                    const title = fileField.name || 'Untitled File';

                    // Filter by search text if provided
                    if (!searchText || title.toLowerCase().includes(searchText.toLowerCase())) {
                      allDocumentTools.push(
                        ReferenceTool.fromFile(
                          fileField.id,
                          organizationId.value,
                          title,
                          fileField.mimeType || 'application/octet-stream',
                          table.name,
                          table.id.value,
                          fieldId,
                          rowDTO.id,
                          database.name
                        )
                      );
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error searching documents in table ${table.name}:`, error);
          continue;
        }
      }
    }

    console.log(`[searchDocumentTools] Search completed. Found ${allDocumentTools.length} total documents`);
    return allDocumentTools.slice(0, limit);
  }


  /**
   * Extract the actual search text from query (remove @ prefixes)
   */
  private extractSearchText(query: string): string {
    const patterns = [
      /^@doc:(.*)$/,
      /^@file:(.*)$/,
      /^@agent:(.*)$/,
      /^@table:(.*)$/,
      /^@database:(.*)$/,
      /^@(.*)$/
    ];

    for (const pattern of patterns) {
      const match = query.trim().match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return query.trim();
  }

  /**
   * Sort ReferenceTool objects by relevance to search query
   */
  private sortReferenceToolsByRelevance(referenceTools: ReferenceTool[], query: string): ReferenceTool[] {
    const searchText = this.extractSearchText(query).toLowerCase();

    if (!searchText) {
      return referenceTools;
    }

    return referenceTools.sort((a, b) => {
      const aDisplayName = a.reference.displayName.toLowerCase();
      const bDisplayName = b.reference.displayName.toLowerCase();

      // Exact matches in display name get highest priority
      const aDisplayExact = aDisplayName === searchText ? 2 : 0;
      const bDisplayExact = bDisplayName === searchText ? 2 : 0;

      // Starts with matches get medium priority
      const aDisplayStarts = aDisplayName.startsWith(searchText) ? 1 : 0;
      const bDisplayStarts = bDisplayName.startsWith(searchText) ? 1 : 0;

      // Contains matches get low priority
      const aDisplayContains = aDisplayName.includes(searchText) ? 0.5 : 0;
      const bDisplayContains = bDisplayName.includes(searchText) ? 0.5 : 0;

      const aScore = aDisplayExact + aDisplayStarts + aDisplayContains;
      const bScore = bDisplayExact + bDisplayStarts + bDisplayContains;

      return bScore - aScore;
    });
  }

  /**
   * Sort Tool objects by relevance to search query
   */
  private sortSystemToolsByRelevance(tools: Tool[], query: string): Tool[] {
    const searchText = this.extractSearchText(query).toLowerCase();

    if (!searchText) {
      return tools;
    }

    return tools.sort((a, b) => {
      const aDisplayName = a.toolMetadata.displayName.toLowerCase();
      const bDisplayName = b.toolMetadata.displayName.toLowerCase();

      // Exact matches in display name get highest priority
      const aDisplayExact = aDisplayName === searchText ? 2 : 0;
      const bDisplayExact = bDisplayName === searchText ? 2 : 0;

      // Starts with matches get medium priority
      const aDisplayStarts = aDisplayName.startsWith(searchText) ? 1 : 0;
      const bDisplayStarts = bDisplayName.startsWith(searchText) ? 1 : 0;

      // Contains matches get low priority
      const aDisplayContains = aDisplayName.includes(searchText) ? 0.5 : 0;
      const bDisplayContains = bDisplayName.includes(searchText) ? 0.5 : 0;

      const aScore = aDisplayExact + aDisplayStarts + aDisplayContains;
      const bScore = bDisplayExact + bDisplayStarts + bDisplayContains;

      return bScore - aScore;
    });
  }

}