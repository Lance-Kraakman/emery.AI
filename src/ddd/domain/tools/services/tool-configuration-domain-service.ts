/**
 * Tool Configuration Domain Service Implementation
 *
 * Implements business logic for tool configuration enhancement.
 * Handles authentication enrichment and validation according to domain rules.
 *
 * AIDEV-NOTE: Pure domain service with no external dependencies.
 * Contains business rules for tool authentication and configuration.
 */

import { ToolConfig } from '../value-objects/tool-config';
import { ConnectionType } from '../value-objects/tool-metadata';
import { IToolConfigurationService } from './tool-configuration-service';

export class ToolConfigurationDomainService implements IToolConfigurationService {

  /**
   * Enrich tool configurations with authentication credentials
   */
  enrichWithAuthentication(tools: ToolConfig[], agentApiKey: string): ToolConfig[] {
    return tools.map(tool => this.enrichSingleTool(tool, agentApiKey));
  }

  /**
   * Validate that a tool configuration has required authentication
   * @param toolConfig - Tool configuration to validate
   * @param connectionType - Optional connection type from tool metadata (from database)
   */
  hasValidAuthentication(toolConfig: ToolConfig, connectionType?: ConnectionType): boolean {
    const authType = this.getRequiredAuthType(toolConfig.name, connectionType);

    switch (authType) {
      case 'api_key':
        return toolConfig.isApiKeyTool() && !!toolConfig.getApiKeyConfig()?.api_key;
      case 'oauth':
        return toolConfig.isOAuthTool() && !!toolConfig.getOAuthConfig()?.oauth_token;
      case 'none':
        return true;
      default:
        return false;
    }
  }

  /**
   * Get the authentication type required for a tool
   * @param toolName - Name of the tool
   * @param connectionType - Optional connection type from tool metadata (database source of truth)
   */
  getRequiredAuthType(toolName: string, connectionType?: ConnectionType): 'api_key' | 'oauth' | 'none' {
    // AIDEV-NOTE: Prefer database metadata (connectionType) over name patterns
    // Database is the source of truth for tool authentication requirements
    if (connectionType) {
      switch (connectionType) {
        case ConnectionType.API_KEY:
          return 'api_key';
        case ConnectionType.OAUTH:
          return 'oauth';
        case ConnectionType.NONE:
          return 'none';
      }
    }

    // Fallback: Use name patterns only when metadata not available
    // This maintains backwards compatibility for tools not yet in database
    const lowerName = toolName.toLowerCase();

    // Internal tools typically don't require external authentication
    if (this.isInternalTool(lowerName)) {
      return 'none';
    }

    // Default to API key for external tools when metadata unavailable
    return 'api_key';
  }

  /**
   * Enrich a single tool configuration with authentication
   */
  private enrichSingleTool(tool: ToolConfig, agentApiKey: string): ToolConfig {
    const authType = this.getRequiredAuthType(tool.name);

    // If tool already has valid authentication, preserve it
    if (this.hasValidAuthentication(tool)) {
      return tool;
    }

    // Add authentication based on required type
    switch (authType) {
      case 'api_key':
        return this.addApiKeyAuthentication(tool, agentApiKey);
      case 'oauth':
        // OAuth tokens should be handled separately - don't override
        return tool;
      case 'none':
        // No authentication required
        return tool;
      default:
        return tool;
    }
  }

  /**
   * Add API key authentication to a tool configuration
   */
  private addApiKeyAuthentication(tool: ToolConfig, agentApiKey: string): ToolConfig {
    // Use the existing ToolConfig.withConfig method to add authentication
    return tool.withConfig({
      api_key: agentApiKey,
      base_url: this.getDefaultBaseUrl()
    });
  }

  /**
   * Check if a tool is an internal tool
   * AIDEV-NOTE: This is a fallback for when database metadata is unavailable
   */
  private isInternalTool(toolName: string): boolean {
    // Business rule: Internal tools typically have specific prefixes
    const internalPrefixes = [
      'agent_', 'table_', 'document_', 'file_', 'database_',
      'crud_', 'internal_', 'system_'
    ];

    return internalPrefixes.some(prefix => toolName.startsWith(prefix));
  }

  /**
   * Get default base URL for tool proxy
   */
  private getDefaultBaseUrl(): string {
    // Business rule: Default to localhost for development, production URL for production
    if (typeof window !== 'undefined') {
      // Browser environment
      return window.location.origin;
    }

    // Server environment
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
}