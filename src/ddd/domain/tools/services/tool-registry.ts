/**
 * Tool Registry Domain Service Interface
 *
 * Domain service for tool discovery and metadata management.
 * Interface lives in domain layer, implementation in infrastructure.
 *
 * AIDEV-NOTE: Domain service pattern - defines contract for tool discovery
 * without coupling to specific implementation (Python, database, etc.)
 *
 * AIDEV-TODO: Add gRPC integration for dynamic tool discovery from Python workers.
 * Should discover tools available on Python gRPC agents at runtime.
 * See agent_worker.proto for tool_discovery and tool_metadata services.
 */

import { ToolConfig } from '../value-objects/tool-config'
import { ToolMetadata, ToolCategory } from '../value-objects/tool-metadata'
import type { Tool } from '../entities/tool'

/**
 * Tool discovery options
 */
export interface ToolDiscoveryOptions {
  category?: ToolCategory
  requiresConnection?: boolean
  searchQuery?: string
  tags?: string[]
  appId?: string // Filter by specific app
  connectedOnly?: boolean // Only show tools with active connections
  userId?: string // User ID for connection filtering
  organizationId?: number // Organization ID for connection filtering
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

  /**
   * Create a Tool instance from ToolMetadata
   */
  createTool(metadata: ToolMetadata, customConfig?: Record<string, any>): Tool

  /**
   * AIDEV-TODO: Add gRPC tool discovery methods
   * - discoverGrpcTools(workerId: string): Promise<ToolMetadata[]>
   * - syncToolsFromWorkers(): Promise<void>
   * - getWorkerToolCapabilities(workerId: string): Promise<ToolCapability[]>
   */
}