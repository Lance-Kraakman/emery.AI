/**
 * Reference Application Service
 * 
 * Orchestrates cross-domain reference searches for chat mentions.
 * Leverages existing DDD services for proper pagination and filtering.
 * 
 * AIDEV-NOTE: This service consolidates reference search across agents, tables, 
 * documents, files by using existing TableApplicationService, AgentApplicationService etc.
 */

import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { Reference, referenceToSimple } from '@/ddd/domain/chat/value-objects/reference';
import { ReferenceCategory } from '@/ddd/domain/chat/value-objects/reference-types';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import type { AgentApplicationService } from '@/ddd/application/services/agents/agent-application-service';
import type { DatabaseApplicationService } from '@/ddd/application/services/database/database-application-service';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import { RowMapper, type DocumentFieldValue, type FileFieldValue } from '@/app/mappers/row-mapper';
import { isDocumentArray, isFileArray } from '@/ddd/domain/tables/value-objects/field-values';

// Legacy interface for backward compatibility
export interface SimpleReference {
  id: string;
  insertText: string;      // "@doc:database/table/document-title"
  displayName: string;     // "John's Profile Document"
  description: string;     // "Document in Users table"
  category: 'doc' | 'file' | 'agent' | 'table' | 'database';
}

export interface SearchReferencesOptions {
  query: string;
  categories?: ReferenceCategory[];
  limit?: number;
  offset?: number;
  organizationId: OrganizationId;
}

export interface SearchReferencesResult {
  references: SimpleReference[];
  hasMore: boolean;
  totalCount: number;
}

export class ReferenceApplicationService {
  constructor(
    private readonly tableApplicationService: TableApplicationService,
    private readonly agentApplicationService: AgentApplicationService,
    private readonly databaseApplicationService: DatabaseApplicationService
  ) {}

  /**
   * Search across all reference categories with proper pagination
   */
  async searchReferences(options: SearchReferencesOptions): Promise<SearchReferencesResult> {
    const { query, categories, limit = 20, offset = 0, organizationId } = options;
    
    // Determine what categories to search based on query pattern
    const searchCategories = this.determineSearchCategories(query, categories);
    
    // Execute searches in parallel for better performance
    const searchPromises = searchCategories.map(category => 
      this.searchByCategory(category, query, organizationId, limit, offset)
    );
    
    const categoryResults = await Promise.all(searchPromises);
    
    // Combine and sort results
    const allReferences = categoryResults.flat();
    const sortedReferences = this.sortReferencesByRelevance(allReferences, query);
    
    // Apply pagination to combined results
    const paginatedReferences = sortedReferences.slice(offset, offset + limit);
    const hasMore = sortedReferences.length > offset + limit;
    
    return {
      references: paginatedReferences,
      hasMore,
      totalCount: sortedReferences.length
    };
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
   * Search within a specific category using the appropriate service
   */
  private async searchByCategory(
    category: 'doc' | 'file' | 'agent' | 'table' | 'database',
    query: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<SimpleReference[]> {
    const searchText = this.extractSearchText(query);
    
    try {
      switch (category) {
        case 'agent':
          return await this.searchAgents(searchText, organizationId, limit, offset);
        
        case 'table':
          return await this.searchTables(searchText, organizationId, limit, offset);
        
        case 'database':
          return await this.searchDatabases(searchText, organizationId, limit, offset);
        
        case 'doc':
        case 'file':
          return await this.searchDocuments(searchText, organizationId, limit, offset);
        
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error searching ${category}:`, error);
      return [];
    }
  }

  /**
   * Search agents using AgentApplicationService
   */
  private async searchAgents(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<SimpleReference[]> {
    const agents = await this.agentApplicationService.getAgents({
      organizationId,
      searchQuery: searchText,
      status: 'active'
    });

    // Apply pagination manually since AgentApplicationService doesn't support offset
    const paginatedAgents = agents.slice(offset, offset + limit);

    return paginatedAgents.map(agent => {
      const reference = Reference.agent(
        `agent-${agent.id.value}`,
        agent.name,
        `${agent.role || 'Agent'} - ${agent.description || 'No description'}`
      );
      return referenceToSimple(reference);
    });
  }

  /**
   * Search tables using DatabaseApplicationService
   */
  private async searchTables(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<SimpleReference[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    const allTables: SimpleReference[] = [];

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
        .map(table => ({
          id: `table-${table.id.value}`,
          insertText: `@table:${database.name}/${table.name}`,
          displayName: table.name,
          description: `Table in ${database.name} - ${table.description || 'No description'}`,
          category: 'table' as const
        }));

      allTables.push(...matchingTables);
    }

    // Apply pagination
    return allTables.slice(offset, offset + limit);
  }

  /**
   * Search databases using DatabaseApplicationService
   */
  private async searchDatabases(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<SimpleReference[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    
    const matchingDatabases = databases
      .filter(database => 
        !searchText || 
        database.name.toLowerCase().includes(searchText.toLowerCase()) ||
        database.description?.toLowerCase().includes(searchText.toLowerCase())
      )
      .slice(offset, offset + limit)
      .map(database => ({
        id: `database-${database.id.value}`,
        insertText: `@database:${database.name}`,
        displayName: database.name,
        description: `Database - ${database.description || 'No description'}`,
        category: 'database' as const
      }));

    return matchingDatabases;
  }

  /**
   * Search documents/files using TableApplicationService with proper pagination
   */
  private async searchDocuments(
    searchText: string,
    organizationId: OrganizationId,
    limit: number,
    offset: number
  ): Promise<SimpleReference[]> {
    const databases = await this.databaseApplicationService.getDatabases({ organizationId });
    const allDocuments: SimpleReference[] = [];

    // Search through all tables for document-like content
    const allOrgTables = await this.tableApplicationService.getTablesForOrganization(organizationId);
    
    for (const database of databases) {
      const tables = allOrgTables.filter(table => table.databaseId.equals(database.id));
      
      for (const table of tables) {
        try {
          // Use TableApplicationService.getRows with proper pagination
          // Note: We do filtering after RowMapper.toDTO() for proper document/file name matching
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
                if (fieldValue.fieldType === 'document' && fieldValue.value && isDocumentArray(fieldValue.value)) {
                  // Handle DocumentArrayFieldValue - iterate through each document
                  const docArray = fieldValue.value as DocumentFieldValue[];
                  for (const docField of docArray) {
                    const title = docField.documentMetadata?.title || docField.name || 'Untitled Document';
                    
                    // Filter by search text if provided
                    if (!searchText || title.toLowerCase().includes(searchText.toLowerCase())) {
                      allDocuments.push({
                        id: `doc-${table.id.value}-${row.id}-${docField.id}`,
                        insertText: `@doc:${database.name}/${table.name}/${title}`,
                        displayName: title,
                        description: `Document in ${table.name} table`,
                        category: 'doc' as const
                      });
                    }
                  }
                } else if (fieldValue.fieldType === 'file' && fieldValue.value && isFileArray(fieldValue.value)) {
                  // Handle FileArrayFieldValue - iterate through each file  
                  const fileArray = fieldValue.value as FileFieldValue[];
                  for (const fileField of fileArray) {
                    const title = fileField.name || 'Untitled File';
                    
                    // Filter by search text if provided
                    if (!searchText || title.toLowerCase().includes(searchText.toLowerCase())) {
                      allDocuments.push({
                        id: `file-${table.id.value}-${row.id}-${fileField.id}`,
                        insertText: `@file:${database.name}/${table.name}/${title}`,
                        displayName: title,
                        description: `File in ${table.name} table (${fileField.mimeType})`,
                        category: 'file' as const
                      });
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

    return allDocuments.slice(0, limit);
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
   * Sort references by relevance to search query
   */
  private sortReferencesByRelevance(references: SimpleReference[], query: string): SimpleReference[] {
    const searchText = this.extractSearchText(query).toLowerCase();
    
    if (!searchText) {
      return references;
    }

    return references.sort((a, b) => {
      // Exact matches in display name get highest priority
      const aDisplayExact = a.displayName.toLowerCase() === searchText ? 2 : 0;
      const bDisplayExact = b.displayName.toLowerCase() === searchText ? 2 : 0;
      
      // Starts with matches get medium priority
      const aDisplayStarts = a.displayName.toLowerCase().startsWith(searchText) ? 1 : 0;
      const bDisplayStarts = b.displayName.toLowerCase().startsWith(searchText) ? 1 : 0;
      
      // Contains matches get low priority
      const aDisplayContains = a.displayName.toLowerCase().includes(searchText) ? 0.5 : 0;
      const bDisplayContains = b.displayName.toLowerCase().includes(searchText) ? 0.5 : 0;

      const aScore = aDisplayExact + aDisplayStarts + aDisplayContains;
      const bScore = bDisplayExact + bDisplayStarts + bDisplayContains;

      return bScore - aScore;
    });
  }
}