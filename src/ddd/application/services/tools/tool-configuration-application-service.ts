/**
 * Tool Configuration Application Service
 *
 * Orchestrates tool configuration enhancement by combining user agent lookup
 * with domain service logic for tool authentication.
 *
 * AIDEV-NOTE: Application service following established DDD patterns.
 * Coordinates between domain services and repositories to fulfill use cases.
 */

import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('ToolConfig');
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { IToolConfigurationService } from '@/ddd/domain/tools/services/tool-configuration-service';
import { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { Result } from '@/ddd/domain/shared/result';

export interface EnrichToolsWithUserApiKeyCommand {
  tools: ToolConfig[];
  userApiKey: string;
}

export interface EnrichToolsWithUserApiKeyResult {
  enrichedTools: ToolConfig[];
  userApiKeyProvided: boolean;
}



export class ToolConfigurationApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly toolConfigurationService: IToolConfigurationService,
    private readonly toolRegistryService: IToolRegistryService
  ) {}

  /**
   * Validate that tools have proper authentication for execution
   *
   * @param tools - Array of tool configurations to validate
   * @returns Result with validation status and details
   */
  async validateToolAuthentication(tools: ToolConfig[]): Promise<Result<{
    allValid: boolean;
    validTools: string[];
    invalidTools: string[];
  }>> {
    try {
      const validTools: string[] = [];
      const invalidTools: string[] = [];

      for (const tool of tools) {
        // Get tool metadata from database to determine required authentication type
        const metadata = await this.toolRegistryService.getToolMetadata(tool.name);
        if (!metadata) {
          // Tool not found in registry - treat as invalid
          invalidTools.push(tool.name);
          continue;
        }

        // Use domain service with ConnectionType from database metadata
        if (this.toolConfigurationService.hasValidAuthentication(tool, metadata.connectionType)) {
          validTools.push(tool.name);
        } else {
          invalidTools.push(tool.name);
        }
      }

      return {
        success: true,
        data: {
          allValid: invalidTools.length === 0,
          validTools,
          invalidTools
        }
      };

    } catch (error) {
      logger.error('Failed to validate tools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate tool authentication'
      };
    }
  }

  /**
   * Get authentication requirements for a set of tools
   *
   * @param toolNames - Array of tool names to check
   * @returns Result with authentication requirements per tool
   */
  async getAuthenticationRequirements(toolNames: string[]): Promise<Result<{
    [toolName: string]: 'api_key' | 'oauth' | 'none';
  }>> {
    try {
      const requirements: { [toolName: string]: 'api_key' | 'oauth' | 'none' } = {};

      for (const toolName of toolNames) {
        // Get tool metadata from database
        const metadata = await this.toolRegistryService.getToolMetadata(toolName);
        if (!metadata) {
          // Tool not found - default to 'none' (no auth required if tool doesn't exist)
          requirements[toolName] = 'none';
          continue;
        }

        // Use domain service with ConnectionType from database metadata
        requirements[toolName] = this.toolConfigurationService.getRequiredAuthType(metadata.connectionType);
      }

      return {
        success: true,
        data: requirements
      };

    } catch (error) {
      logger.error('Failed to get auth requirements:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get authentication requirements'
      };
    }
  }

  /**
   * Enrich tool configurations with user API key directly
   *
   * Use Case: User wants to execute tools via chat interface using their own API key.
   * This service enriches tools with the user's API key for direct OAuth proxy access.
   *
   * @param command - Command containing tools to enrich and user API key
   * @returns Result with enriched tools using user API key
   */
  async enrichToolsWithUserApiKey(command: EnrichToolsWithUserApiKeyCommand): Promise<Result<EnrichToolsWithUserApiKeyResult>> {
    try {
      // 1. Validate input
      if (!command.tools || command.tools.length === 0) {
        return {
          success: true,
          data: {
            enrichedTools: [],
            userApiKeyProvided: false
          }
        };
      }

      if (!command.userApiKey) {
        logger.debug('No user API key provided');
        return {
          success: true,
          data: {
            enrichedTools: command.tools, // Return original tools without enrichment
            userApiKeyProvided: false
          }
        };
      }

      logger.debug(`Enriching ${command.tools.length} tools with user API key`);

      // 2. Use domain service to enrich tools with user API key
      const enrichedTools = this.toolConfigurationService.enrichWithAuthentication(
        command.tools,
        command.userApiKey
      );

      logger.debug(`Successfully enriched tools with user API key`);

      return {
        success: true,
        data: {
          enrichedTools,
          userApiKeyProvided: true
        }
      };

    } catch (error) {
      logger.error('Failed to enrich tools with user API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrich tools with user API key'
      };
    }
  }

}