/**
 * Tool Configuration Service Interface
 *
 * Domain service for tool configuration enhancement and validation.
 * Handles pure business logic for enriching tool configurations with authentication.
 *
 * AIDEV-NOTE: Domain service interface following DDD patterns.
 * Contains business rules for tool authentication and configuration enhancement.
 * Uses database metadata (ConnectionType) as source of truth for auth requirements.
 */

import { ToolConfig } from '../value-objects/tool-config';
import { ConnectionType } from '../value-objects/tool-metadata';

export interface IToolConfigurationService {
  /**
   * Enrich tool configurations with authentication credentials
   *
   * Business Rules:
   * - Tools without existing auth get the provided API key
   * - Tools with existing authentication are preserved
   * - Base URL is set to default if not provided
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
   * @param connectionType - Connection type from database metadata (required)
   * @returns true if tool has valid authentication, false otherwise
   */
  hasValidAuthentication(toolConfig: ToolConfig, connectionType: ConnectionType): boolean;

  /**
   * Get the authentication type required for a tool
   *
   * @param connectionType - Connection type from database metadata (required)
   * @returns Authentication type required ('api_key', 'oauth', 'none')
   */
  getRequiredAuthType(connectionType: ConnectionType): 'api_key' | 'oauth' | 'none';
}