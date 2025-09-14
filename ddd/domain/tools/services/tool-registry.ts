/**
 * Tool Registry Domain Service Interface
 *
 * Domain service for tool discovery and metadata management.
 * Interface lives in domain layer, implementation in infrastructure.
 *
 * AIDEV-NOTE: Domain service pattern - defines contract for tool discovery
 * without coupling to specific implementation (Python, database, etc.)
 */

import { ToolConfig } from '../value-objects/tool-config'
import { ToolMetadata, ToolCategory } from '../value-objects/tool-metadata'

/**
 * Tool discovery options
 */
export interface ToolDiscoveryOptions {
  category?: ToolCategory
  requiresConnection?: boolean
  searchQuery?: string
  tags?: string[]
  limit?: number
  offset?: number
}

/**
 * Tool discovery result
 */
export interface ToolDiscoveryResult {
  tools: ToolMetadata[]
  totalCount: number
  hasMore: boolean
}

/**
 * Tool availability information
 */
export interface ToolAvailability {
  available: boolean
  reason?: string
  connectionRequired?: boolean
  connectionConfigured?: boolean
}

/**
 * Domain service interface for tool registry operations
 */
export interface IToolRegistryService {
  /**
   * Discover available tools based on criteria
   */
  discoverTools(options: ToolDiscoveryOptions): Promise<ToolDiscoveryResult>

  /**
   * Get metadata for a specific tool
   */
  getToolMetadata(toolName: string): Promise<ToolMetadata | null>

  /**
   * Check if a tool is available for use
   */
  checkToolAvailability(toolName: string, organizationId?: number): Promise<ToolAvailability>

  /**
   * Get tools by category
   */
  getToolsByCategory(category: ToolCategory): Promise<ToolMetadata[]>

  /**
   * Search tools by query
   */
  searchTools(query: string, limit?: number): Promise<ToolMetadata[]>

  /**
   * Validate tool configuration
   */
  validateToolConfig(config: ToolConfig): Promise<{ valid: boolean; errors?: string[] }>

  /**
   * Get all available categories
   */
  getAvailableCategories(): Promise<ToolCategory[]>
}