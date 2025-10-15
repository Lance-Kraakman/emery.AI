/**
 * Tool Proxy Domain Service Interface
 *
 * Domain service for handling tool execution via proxy pattern.
 * Abstracts connection management and tool execution concerns.
 *
 * AIDEV-NOTE: Domain service that encapsulates the proxy pattern for tools
 * that require external connections (OAuth, API keys, etc.)
 *
 * AIDEV-TODO: Enhance for gRPC tool execution integration.
 * Should coordinate between local tool registry and remote gRPC worker execution.
 * Add streaming support for long-running tool operations via gRPC streams.
 */

import { ToolConfig } from '../value-objects/tool-config'

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  toolConfig: ToolConfig
  action: string
  parameters: Record<string, any>
  organizationId: number
  userId: string
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
  executionTime?: number
  metadata?: Record<string, any>
}

/**
 * Connection status for tools that require external connections
 */
export interface ConnectionStatus {
  connected: boolean
  connectionType: 'oauth' | 'api_key' | 'none'
  lastValidated?: Date
  expiresAt?: Date
  error?: string
}

/**
 * Domain service interface for tool proxy operations
 */
export interface IToolProxyService {
  /**
   * Execute a tool via the proxy
   */
  executeViaProxy(request: ToolExecutionRequest): Promise<ToolExecutionResult>

  /**
   * Check connection status for a tool
   */
  checkConnectionStatus(
    toolName: string,
    organizationId: number,
    userId: string
  ): Promise<ConnectionStatus>

  /**
   * Validate that a tool can be executed
   */
  validateExecution(request: ToolExecutionRequest): Promise<{ valid: boolean; error?: string }>

  /**
   * Get required connection configuration for a tool
   */
  getConnectionRequirements(toolName: string): Promise<{
    requiresConnection: boolean
    connectionType?: 'oauth' | 'api_key'
    configurationFields?: string[]
  }>

  /**
   * AIDEV-TODO: Add gRPC worker coordination methods
   * - executeOnWorker(workerId: string, request: ToolExecutionRequest): Promise<ToolExecutionResult>
   * - streamToolExecution(workerId: string, request: ToolExecutionRequest): AsyncIterable<ToolExecutionUpdate>
   * - getWorkerHealth(workerId: string): Promise<WorkerHealthStatus>
   * - routeToolToOptimalWorker(toolName: string): Promise<string>
   */
}