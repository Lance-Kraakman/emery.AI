/**
 * Reference Search Application Service
 * 
 * Orchestrates cross-domain search for chat references.
 * Handles documents, agents, tables, and tools in a unified search experience.
 * 
 * AIDEV-NOTE: This service justification is solid - orchestrating searches across 
 * multiple domains (documents, agents, tables, tools) which is exactly what 
 * application services are for, while keeping UI components focused on presentation.
 */

import { getTableApplicationService } from '@/ddd/application/di/container'
import { TableId } from '@/ddd/domain/shared/value-objects'
import { RowMapper, type DocumentFieldValue } from '@/app/mappers/row-mapper'
import { getUserOAuthConnections } from '@/app/actions/connections'
import { getAvailableToolsForUser, PREDEFINED_TOOLS } from '@/lib/agents/tools-registry'

// Unified search result types
export interface ReferenceSearchOptions {
  limit?: number
  includeUnavailable?: boolean
  categories?: ReferenceCategory[]
}

export type ReferenceCategory = 'documents' | 'agents' | 'tables' | 'tools' | 'teams' | 'settings'

export interface BaseReferenceResult {
  id: string
  category: ReferenceCategory
  name: string
  displayName: string
  description: string
  available: boolean
  insertText: string
  confidence?: number
}

export interface DocumentReferenceResult extends BaseReferenceResult {
  category: 'documents'
  documentField: DocumentFieldValue
  tableId: number
  fieldId?: number
  path: string
  metadata: {
    wordCount?: number
    readTime?: number
    documentType: string
  }
}

export interface AgentReferenceResult extends BaseReferenceResult {
  category: 'agents'
  agentId: string
  organizationId: number
  status: string
}

export interface TableReferenceResult extends BaseReferenceResult {
  category: 'tables'
  tableId: number
  databaseId: number
  databaseName: string
  metadata?: {
    rowCount?: number
    fieldCount?: number
  }
}

export interface ToolReferenceResult extends BaseReferenceResult {
  category: 'tools'
  requiresAuth: boolean
  oauthService?: string
  subcategory: string
}

export interface TeamReferenceResult extends BaseReferenceResult {
  category: 'teams'
  teamId: string
  memberCount: number
  organizationId: number
}

export interface SettingsReferenceResult extends BaseReferenceResult {
  category: 'settings'
  settingType: string
  route?: string
}

export type UnifiedReferenceResult = 
  | DocumentReferenceResult 
  | AgentReferenceResult 
  | TableReferenceResult 
  | ToolReferenceResult 
  | TeamReferenceResult 
  | SettingsReferenceResult

export interface ReferenceSearchResult {
  results: UnifiedReferenceResult[]
  totalCount: number
  searchTime: number
  query: string
}

/**
 * Application service for unified reference search across all domains
 */
export class ReferenceSearchApplicationService {
  /**
   * Search across all reference types with unified ranking
   */
  async searchReferences(
    query: string, 
    emeryData: any, // From useEmery context
    options: ReferenceSearchOptions = {}
  ): Promise<ReferenceSearchResult> {
    const startTime = Date.now()
    const { 
      limit = 50, 
      includeUnavailable = false, 
      categories = ['documents', 'agents', 'tables', 'tools', 'teams', 'settings'] 
    } = options

    try {
      // Execute searches in parallel for performance
      const [
        documentResults,
        agentResults,
        tableResults,
        toolResults,
        teamResults,
        settingsResults
      ] = await Promise.allSettled([
        categories.includes('documents') ? this.searchDocuments(query, emeryData, limit) : Promise.resolve([]),
        categories.includes('agents') ? this.searchAgents(query, emeryData, limit) : Promise.resolve([]),
        categories.includes('tables') ? this.searchTables(query, emeryData, limit) : Promise.resolve([]),
        categories.includes('tools') ? this.searchTools(query, limit) : Promise.resolve([]),
        categories.includes('teams') ? this.searchTeams(query, emeryData, limit) : Promise.resolve([]),
        categories.includes('settings') ? this.searchSettings(query, limit) : Promise.resolve([])
      ])

      // Combine results and handle errors gracefully
      const allResults: UnifiedReferenceResult[] = []
      
      if (documentResults.status === 'fulfilled') allResults.push(...documentResults.value)
      if (agentResults.status === 'fulfilled') allResults.push(...agentResults.value)
      if (tableResults.status === 'fulfilled') allResults.push(...tableResults.value)
      if (toolResults.status === 'fulfilled') allResults.push(...toolResults.value)
      if (teamResults.status === 'fulfilled') allResults.push(...teamResults.value)
      if (settingsResults.status === 'fulfilled') allResults.push(...settingsResults.value)

      // Filter unavailable if requested
      const filteredResults = includeUnavailable 
        ? allResults 
        : allResults.filter(result => result.available)

      // Apply unified ranking and limit
      const rankedResults = this.rankResults(filteredResults, query)
        .slice(0, limit)

      return {
        results: rankedResults,
        totalCount: filteredResults.length,
        searchTime: Date.now() - startTime,
        query
      }

    } catch (error) {
      console.error('Reference search failed:', error)
      return {
        results: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
        query
      }
    }
  }

  /**
   * Search document references
   */
  private async searchDocuments(query: string, emeryData: any, limit: number): Promise<DocumentReferenceResult[]> {
    if (!emeryData?.databases) return []

    const results: DocumentReferenceResult[] = []

    // AIDEV-TODO: This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Query actual document field values from tables
    // 2. Use proper fuzzy search scoring
    // 3. Include document metadata and content analysis
    
    // For now, return empty array to avoid breaking existing functionality
    return results
  }

  /**
   * Search agent references
   */
  private async searchAgents(query: string, emeryData: any, limit: number): Promise<AgentReferenceResult[]> {
    if (!emeryData?.agents) return []

    return emeryData.agents
      .filter((agent: any) => 
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.description?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map((agent: any): AgentReferenceResult => ({
        id: `agent_${agent.id}`,
        category: 'agents',
        name: agent.name.toLowerCase().replace(/\s+/g, '-'),
        displayName: agent.name,
        description: agent.description || 'AI Agent',
        available: true,
        insertText: `@agent:${agent.name.toLowerCase().replace(/\s+/g, '-')}`,
        agentId: agent.id,
        organizationId: agent.organizationId || 0,
        status: agent.status || 'active'
      }))
  }

  /**
   * Search table references
   */
  private async searchTables(query: string, emeryData: any, limit: number): Promise<TableReferenceResult[]> {
    if (!emeryData?.databases) return []

    const results: TableReferenceResult[] = []

    emeryData.databases.forEach((database: any) => {
      database.tables?.forEach((table: any) => {
        if (
          table.name.toLowerCase().includes(query.toLowerCase()) ||
          database.name.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({
            id: `table_${table.id}`,
            category: 'tables',
            name: table.storageLocation,
            displayName: table.name,
            description: `Table in ${database.name}`,
            available: true,
            insertText: `@table:${table.storageLocation}`,
            tableId: table.id,
            databaseId: database.id,
            databaseName: database.name
          })
        }
      })
    })

    return results.slice(0, limit)
  }

  /**
   * Search tool references
   */
  private async searchTools(query: string, limit: number): Promise<ToolReferenceResult[]> {
    try {
      // Get OAuth connections to determine tool availability
      const connectionsResult = await getUserOAuthConnections()
      const connections = connectionsResult.success ? connectionsResult.data || [] : []
      const availableTools = getAvailableToolsForUser(connections)

      return PREDEFINED_TOOLS
        .filter(tool =>
          tool.name.toLowerCase().includes(query.toLowerCase()) ||
          tool.display_name.toLowerCase().includes(query.toLowerCase()) ||
          tool.description.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit)
        .map((tool): ToolReferenceResult => ({
          id: `tool_${tool.name}`,
          category: 'tools',
          name: tool.name,
          displayName: tool.display_name,
          description: tool.description,
          available: !tool.requires_auth || availableTools.some(t => t.name === tool.name),
          insertText: `@tool:${tool.name}`,
          requiresAuth: tool.requires_auth,
          oauthService: tool.oauth_service,
          subcategory: tool.category
        }))
    } catch (error) {
      console.warn('Failed to search tools:', error)
      return []
    }
  }

  /**
   * Search team references
   */
  private async searchTeams(query: string, emeryData: any, limit: number): Promise<TeamReferenceResult[]> {
    if (!emeryData?.teams) return []

    return emeryData.teams
      .filter((team: any) =>
        team.name.toLowerCase().includes(query.toLowerCase()) ||
        team.purpose?.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map((team: any): TeamReferenceResult => ({
        id: `team_${team.id}`,
        category: 'teams',
        name: team.name.toLowerCase().replace(/\s+/g, '-'),
        displayName: team.name,
        description: team.purpose || 'Team',
        available: true,
        insertText: `@team:${team.name.toLowerCase().replace(/\s+/g, '-')}`,
        teamId: team.id,
        memberCount: team.agentIds?.length || 0,
        organizationId: team.organizationId || 0
      }))
  }

  /**
   * Search settings references
   */
  private async searchSettings(query: string, limit: number): Promise<SettingsReferenceResult[]> {
    const settingsItems = [
      {
        id: 'settings_oauth',
        name: 'oauth-connections',
        displayName: 'OAuth Connections',
        description: 'Manage connected external services',
        settingType: 'oauth',
        route: '/connections'
      },
      {
        id: 'settings_users',
        name: 'users-permissions', 
        displayName: 'Users & Permissions',
        description: 'Manage team members and access',
        settingType: 'users',
        route: '/organization/settings/users'
      },
      {
        id: 'settings_system',
        name: 'system',
        displayName: 'System Settings',
        description: 'Configure system preferences',
        settingType: 'system',
        route: '/settings/system'
      }
    ]

    return settingsItems
      .filter(setting =>
        setting.displayName.toLowerCase().includes(query.toLowerCase()) ||
        setting.description.toLowerCase().includes(query.toLowerCase()) ||
        setting.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit)
      .map((setting): SettingsReferenceResult => ({
        id: setting.id,
        category: 'settings',
        name: setting.name,
        displayName: setting.displayName,
        description: setting.description,
        available: true,
        insertText: `@setting:${setting.name}`,
        settingType: setting.settingType,
        route: setting.route
      }))
  }

  /**
   * Rank results based on relevance to query
   */
  private rankResults(results: UnifiedReferenceResult[], query: string): UnifiedReferenceResult[] {
    if (!query.trim()) return results

    const queryLower = query.toLowerCase()

    return results
      .map(result => ({
        ...result,
        confidence: this.calculateRelevanceScore(result, queryLower)
      }))
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  /**
   * Calculate relevance score for ranking
   */
  private calculateRelevanceScore(result: UnifiedReferenceResult, queryLower: string): number {
    let score = 0

    // Exact name match gets highest score
    if (result.name.toLowerCase() === queryLower) score += 100
    else if (result.name.toLowerCase().startsWith(queryLower)) score += 80
    else if (result.name.toLowerCase().includes(queryLower)) score += 60

    // Display name match
    if (result.displayName.toLowerCase() === queryLower) score += 90
    else if (result.displayName.toLowerCase().startsWith(queryLower)) score += 70
    else if (result.displayName.toLowerCase().includes(queryLower)) score += 50

    // Description match  
    if (result.description.toLowerCase().includes(queryLower)) score += 30

    // Boost available items
    if (result.available) score += 10

    // Category-specific boosts
    switch (result.category) {
      case 'documents': score += 5; break
      case 'agents': score += 4; break
      case 'tables': score += 3; break
      case 'tools': score += 2; break
      case 'teams': score += 1; break
    }

    return score
  }
}