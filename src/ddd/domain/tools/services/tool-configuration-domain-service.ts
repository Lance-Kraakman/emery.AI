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
   * @param connectionType - Connection type from tool metadata (required, from database)
   */
  hasValidAuthentication(toolConfig: ToolConfig, connectionType: ConnectionType): boolean {
    const authType = this.getRequiredAuthType(connectionType);

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
   * @param connectionType - Connection type from tool metadata (database is source of truth)
   */
  getRequiredAuthType(connectionType: ConnectionType): 'api_key' | 'oauth' | 'none' {
    // AIDEV-NOTE: Database metadata is the ONLY source of truth for tool authentication
    // No fallback logic - if metadata is missing, that's an error state
    switch (connectionType) {
      case ConnectionType.API_KEY:
        return 'api_key';
      case ConnectionType.OAUTH:
        return 'oauth';
      case ConnectionType.NONE:
        return 'none';
    }
  }

  /**
   * Enrich a single tool configuration with authentication
   * AIDEV-NOTE: Simplified - just add API key if tool doesn't already have auth
   * Tool implementations will use their metadata to determine if they need it
   */
  private enrichSingleTool(tool: ToolConfig, agentApiKey: string): ToolConfig {
    // If tool already has authentication (API key or OAuth), preserve it
    const config = tool.config as any;
    if (config.api_key || config.oauth_token) {
      return tool;
    }

    // Add API key authentication for tools that don't have any auth yet
    return this.addApiKeyAuthentication(tool, agentApiKey);
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