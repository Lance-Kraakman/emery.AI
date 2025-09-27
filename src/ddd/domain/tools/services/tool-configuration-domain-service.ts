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
   */
  hasValidAuthentication(toolConfig: ToolConfig): boolean {
    const authType = this.getRequiredAuthType(toolConfig.name);

    switch (authType) {
      case 'api_key':
        return toolConfig.isApiKeyTool() && !!toolConfig.getApiKeyConfig()?.agent_api_key;
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
   */
  getRequiredAuthType(toolName: string): 'api_key' | 'oauth' | 'none' {
    // Business rule: Tool name patterns that require specific auth types
    const lowerName = toolName.toLowerCase();

    // Tools that use Pipedream proxy require API key authentication
    if (this.isPipedreamTool(lowerName)) {
      return 'api_key';
    }

    // Internal tools typically don't require external authentication
    if (this.isInternalTool(lowerName)) {
      return 'none';
    }

    // Default to API key for external tools
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
      agent_api_key: agentApiKey,
      base_url: this.getDefaultBaseUrl()
    });
  }

  /**
   * Check if a tool is a Pipedream-based tool
   */
  private isPipedreamTool(toolName: string): boolean {
    // Business rule: Pipedream tools typically have app prefixes or are in known list
    const pipedreamApps = [
      'gmail', 'slack', 'github', 'google-sheets', 'google-drive', 'google-docs',
      'google-calendar', 'notion', 'trello', 'discord', 'linear', 'dropbox',
      'airtable', 'hubspot', 'salesforce', 'jira', 'microsoft-teams', 'outlook',
      'zoom', 'stripe', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube'
    ];

    // Check if tool name starts with known app names
    return pipedreamApps.some(app =>
      toolName.startsWith(app + '-') ||
      toolName.startsWith(app + '_') ||
      toolName === app
    );
  }

  /**
   * Check if a tool is an internal tool
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