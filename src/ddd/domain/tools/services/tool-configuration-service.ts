/**
 * Tool Configuration Service Interface
 *
 * Domain service for tool configuration enhancement and validation.
 * Handles pure business logic for enriching tool configurations with authentication.
 *
 * AIDEV-NOTE: Domain service interface following DDD patterns.
 * Contains business rules for tool authentication and configuration enhancement.
 */

import { ToolConfig } from '../value-objects/tool-config';

export interface IToolConfigurationService {
  /**
   * Enrich tool configurations with authentication credentials
   *
   * Business Rules:
   * - Tools requiring authentication get the provided API key
   * - Tools already with authentication are preserved
   * - Base URL is set to default if not provided
   * - Empty API key results in tools that may fail authentication
   *
   * @param tools - Array of tool configurations to enrich
   * @param agentApiKey - Agent API key for tool authentication
   * @returns Array of enriched tool configurations
   */
  enrichWithAuthentication(tools: ToolConfig[], agentApiKey: string): ToolConfig[];

  /**
   * Validate that a tool configuration has required authentication
   *
   * @param toolConfig - Tool configuration to validate
   * @returns true if tool has valid authentication, false otherwise
   */
  hasValidAuthentication(toolConfig: ToolConfig): boolean;

  /**
   * Get the authentication type required for a tool
   *
   * @param toolName - Name of the tool to check
   * @returns Authentication type required ('api_key', 'oauth', 'none')
   */
  getRequiredAuthType(toolName: string): 'api_key' | 'oauth' | 'none';
}