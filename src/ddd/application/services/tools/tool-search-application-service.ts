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

import { OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
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
import { toolResolverService, type SearchCategoryType, type SearchHandlerType, SEARCH_CATEGORIES } from '@/ddd/domain/tools/services/tool-resolver-service';

export interface SearchReferencesOptions {
  query: string;
  categories?: ReferenceCategory[];
  toolCategories?: ToolCategory[]; // Use existing ToolCategory enum for filtering
  appId?: string; // Simple string for app filtering
  connectedOnly?: boolean; // Only show tools with active connections
  requiresConnection?: boolean; // Only show tools that require connections
  limit?: number;
  offset?: number;
  organizationId: OrganizationId;
  userId?: UserId; // User ID for connection filtering
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
    const { query, categories, toolCategories, appId, connectedOnly, requiresConnection, limit = 20, offset = 0, organizationId, userId } = options;

    console.log(`[ToolSearchService] Searching for query: "${query}", categories:`, categories, 'toolCategories:', toolCategories, 'appId:', appId, 'connectedOnly:', connectedOnly, 'requiresConnection:', requiresConnection);

    // Search both reference tools and system tools in parallel
    // Get ALL results first, then apply unified pagination
    const [referenceToolsResult, systemTools] = await Promise.all([
      this.searchOnlyReferenceTools({ ...options, limit: 1000, offset: 0 }),
      this.searchSystemTools(query, toolCategories, appId, connectedOnly, requiresConnection, 1000, organizationId, userId)
    ]);

    console.log(`[ToolSearchService] Found ${referenceToolsResult.referenceTools.length} reference tools, ${systemTools.length} system tools`);

    // Sort by relevance
    const sortedReferenceTools = this.sortReferenceToolsByRelevance(referenceToolsResult.referenceTools, query);
    const sortedSystemTools = this.sortSystemToolsByRelevance(systemTools, query);

    // Combine all results
    const allTools = [...sortedReferenceTools, ...sortedSystemTools];
    const totalItems = allTools.length;

    // Apply unified pagination
    const paginatedTools = allTools.slice(offset, offset + limit);
    const hasMore = offset + limit < totalItems;

    // Separate paginated results back into reference and system tools
    const paginatedReferenceTools: ReferenceTool[] = [];
    const paginatedSystemTools: Tool[] = [];

    for (const tool of paginatedTools) {
      if (tool instanceof ReferenceTool) {
        paginatedReferenceTools.push(tool);
      } else {
        paginatedSystemTools.push(tool);
      }
    }

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
    toolCategories: ToolCategory[] | undefined,
    appId: string | undefined,
    connectedOnly: boolean | undefined,
    requiresConnection: boolean | undefined,
    limit: number = 20,
    organizationId?: OrganizationId,
    userId?: UserId
  ): Promise<Tool[]> {
    console.log(`[ToolSearchService] === STARTING SYSTEM TOOLS SEARCH ===`);
    console.log(`[ToolSearchService] Query: "${query}"`);
    console.log(`[ToolSearchService] ToolCategories:`, toolCategories);
    console.log(`[ToolSearchService] AppId:`, appId);
    console.log(`[ToolSearchService] ConnectedOnly:`, connectedOnly);
    console.log(`[ToolSearchService] RequiresConnection:`, requiresConnection);
    console.log(`[ToolSearchService] Tool registry service:`, !!this.toolRegistryService);

    try {
      // Use the tool registry service with enhanced filtering options
      const toolDiscoveryOptions = {
        searchQuery: query,
        category: toolCategories?.[0], // For now, use first category if provided
        appId,
        connectedOnly,
        requiresConnection,
        userId: userId?.value,
        organizationId: organizationId?.value,
        limit
      };

      console.log(`[ToolSearchService] Calling toolRegistryService.discoverTools with options:`, toolDiscoveryOptions);
      const discoveryResult = await this.toolRegistryService.discoverTools(toolDiscoveryOptions);
      console.log(`[ToolSearchService] Found ${discoveryResult.tools.length} tool metadata entries`);

      // Convert ToolMetadata to Tool instances
      const tools = discoveryResult.tools.map((metadata, index) => {
        console.log(`[ToolSearchService] Creating tool ${index + 1}:`, metadata.name);
        return this.toolRegistryService.createTool(metadata);
      });

      console.log(`[ToolSearchService] Created ${tools.length} system tools`);
      console.log(`[ToolSearchService] === SYSTEM TOOLS SEARCH COMPLETE ===`);

      return tools;
    } catch (error) {
      console.error(`[ToolSearchService] === SYSTEM TOOLS SEARCH FAILED ===`);
      console.error(`[ToolSearchService] Error searching system tools:`, error);
      return [];
    }
  }



  /**
   * Determine which categories to search based on query pattern
   * Uses ToolResolverService for centralized logic
   */
  private determineSearchCategories(
    query: string,
    explicitCategories?: SearchCategoryType[]
  ): SearchCategoryType[] {
    return toolResolverService.determineSearchCategories(query, explicitCategories);
  }

  /**
   * Search within a specific category returning ReferenceTool objects
   * Now uses ToolResolverService for type-safe category handling
   */
  private async searchToolsByCategory(
    category: SearchCategoryType,
    query: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<ReferenceTool[]> {
    const searchText = this.extractSearchText(query);

    try {
      // Use ToolResolverService to determine the appropriate handler
      const handler = toolResolverService.getCategorySearchHandler(category);

      switch (handler) {
        case 'agent':
          return await this.searchAgentTools(searchText, organizationId, limit, offset);

        case 'table':
          return await this.searchTableTools(searchText, organizationId, limit, offset);

        case 'database':
          return await this.searchDatabaseTools(searchText, organizationId, limit, offset);

        case 'document':
          return await this.searchDocumentTools(searchText, organizationId, limit, offset);

        default:
          return [];
      }
    } catch (error) {
      console.error(`Error searching ${category} tools (handler: ${toolResolverService.getCategorySearchHandler(category)}):`, error);
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
      organizationId: organizationId.value,
      searchQuery: searchText,
      status: 'active'
    });

    // Apply pagination manually since AgentApplicationService doesn't support offset
    const paginatedAgents = agents.slice(offset, offset + limit);

    return paginatedAgents.map(agent => {
      return ReferenceTool.fromAgent(
        agent.id,
        organizationId.value,
        agent.ownerId || '',
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
    console.log(`[searchDocumentTools] Starting search. SearchText: "${searchText}", OrgId: ${organizationId.value}, Limit: ${limit}, Offset: ${offset}`);

    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    const allDocumentTools: ReferenceTool[] = [];

    console.log(`[searchDocumentTools] Found ${databases.length} databases`);

    // Search through all tables for document-like content
    const allOrgTables = await this.tableApplicationService.getTablesForOrganization(organizationId);
    console.log(`[searchDocumentTools] Found ${allOrgTables.length} tables for organization`);

    for (const database of databases) {
      const tables = allOrgTables.filter(table => table.databaseId.equals(database.id));
      console.log(`[searchDocumentTools] Database "${database.name}" has ${tables.length} tables`);

      for (const table of tables) {
        try {
          console.log(`[searchDocumentTools] Processing table "${table.name}" (id: ${table.id.value})`);

          // Get table fields to map fieldSlug to fieldId
          const tableFields = await this.tableApplicationService.getFieldsForTable(table.id);
          console.log(`[searchDocumentTools] Table "${table.name}" has ${tableFields.length} fields:`, tableFields.map(f => ({ name: f.name, type: f.type })));

          // Skip tables without document or file fields
          const documentFields = tableFields.filter(field => field.type === 'document' || field.type === 'file');
          console.log(`[searchDocumentTools] Table "${table.name}" has ${documentFields.length} document/file fields`);
          if (documentFields.length === 0) {
            console.log(`[searchDocumentTools] Skipping table "${table.name}" - no document/file fields`);
            continue;
          }

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

          console.log(`[searchDocumentTools] Getting rows for table "${table.name}" with options:`, queryOptions);
          const rows = await this.tableApplicationService.getRows(table.id, queryOptions);
          console.log(`[searchDocumentTools] Table "${table.name}" returned ${rows ? rows.length : 0} rows`);

          if (rows && rows.length > 0) {
            // Process each row using RowMapper to get properly typed field values
            for (const row of rows) {
              const rowDTO = RowMapper.toDTO(row);
              console.log(`[searchDocumentTools] Processing row ${rowDTO.id} with ${rowDTO.fieldValues.length} field values`);

              // Look through all field values to find document and file fields
              for (const fieldValue of rowDTO.fieldValues) {
                const fieldId = fieldSlugToIdMap.get(fieldValue.fieldSlug);
                if (!fieldId) {
                  console.log(`[searchDocumentTools] Could not find fieldId for fieldSlug "${fieldValue.fieldSlug}"`);
                  continue; // Skip if we can't find the fieldId
                }

                console.log(`[searchDocumentTools] Checking field "${fieldValue.fieldSlug}" (type: ${fieldValue.fieldType}), value:`, fieldValue.value);

                if (fieldValue.fieldType === 'document' && fieldValue.value && isDocumentArray(fieldValue.value)) {
                  // Handle DocumentArrayFieldValue - iterate through each document
                  const docArray = fieldValue.value as DocumentFieldValue[];
                  console.log(`[searchDocumentTools] Found ${docArray.length} documents in field "${fieldValue.fieldSlug}"`);

                  for (const docField of docArray) {
                    const title = docField.documentMetadata?.title || docField.name || 'Untitled Document';
                    console.log(`[searchDocumentTools] Document: name="${docField.name}", title="${title}", searchText="${searchText}"`);

                    // AIDEV-NOTE: Search both title AND name fields since documents can have different titles than filenames
                    // Filter by search text if provided - check both title and name
                    const matchesSearch = !searchText ||
                      title.toLowerCase().includes(searchText.toLowerCase()) ||
                      (docField.name && docField.name.toLowerCase().includes(searchText.toLowerCase()));

                    console.log(`[searchDocumentTools] Document "${title}" matches search: ${matchesSearch}`);

                    if (matchesSearch) {
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