/**
 * Tool Configuration Application Service
 *
 * Orchestrates tool configuration enhancement by combining user agent lookup
 * with domain service logic for tool authentication.
 *
 * AIDEV-NOTE: Application service following established DDD patterns.
 * Coordinates between domain services and repositories to fulfill use cases.
 */

import { UserId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { IToolConfigurationService } from '@/ddd/domain/tools/services/tool-configuration-service';
import { IToolRegistryService } from '@/ddd/domain/tools/services/tool-registry';
import type { IAgentRepository } from '@/ddd/domain/agents/repositories/agent-repository';
import type { Result } from '@/ddd/domain/shared/result';

export interface EnrichToolsCommand {
  tools: ToolConfig[];
  userId: UserId;
  organizationId: OrganizationId;
}

export interface EnrichToolsResult {
  enrichedTools: ToolConfig[];
  agentFound: boolean;
  agentApiKeyProvided: boolean;
}

export interface EnrichToolsWithUserApiKeyCommand {
  tools: ToolConfig[];
  userApiKey: string;
}

export interface EnrichToolsWithUserApiKeyResult {
  enrichedTools: ToolConfig[];
  userApiKeyProvided: boolean;
}

export interface EnrichToolsWithAgentApiKeyCommand {
  tools: ToolConfig[];
  agentApiKey: string;
}

export interface EnrichToolsWithAgentApiKeyResult {
  enrichedTools: ToolConfig[];
  agentApiKeyProvided: boolean;
}

export class ToolConfigurationApplicationService {
  constructor(
    private readonly agentRepository: IAgentRepository,
    private readonly toolConfigurationService: IToolConfigurationService,
    private readonly toolRegistryService: IToolRegistryService
  ) {}

  /**
   * Enrich tool configurations with user authentication
   *
   * Use Case: User wants to execute tools that require authentication.
   * This service finds the user's active agent and enriches tools with the agent's API key.
   *
   * @param command - Command containing tools to enrich and user context
   * @returns Result with enriched tools and metadata about agent lookup
   */
  async enrichToolsWithUserAuth(command: EnrichToolsCommand): Promise<Result<EnrichToolsResult>> {
    try {
      // 1. Validate input
      if (!command.tools || command.tools.length === 0) {
        return {
          success: true,
          data: {
            enrichedTools: [],
            agentFound: false,
            agentApiKeyProvided: false
          }
        };
      }

      // 2. Find user's active agents using repository pattern
      const userAgents = await this.agentRepository.findByOwner(
        command.userId,
        command.organizationId
      );

      console.log(`[ToolConfigurationApplicationService] Found ${userAgents.length} agents for user ${command.userId.value}`);
      userAgents.forEach((agent, index) => {
        console.log(`  Agent ${index}: id=${agent.id.value}, name=${agent.name}, status=${agent.status.value}, hasApiKey=${!!agent.apiKey}`);
      });

      // 3. Find the first active agent with an API key
      const activeAgent = userAgents.find(agent =>
        agent.status.isActive() && agent.apiKey
      );

      console.log(`[ToolConfigurationApplicationService] Active agent with API key: ${activeAgent ? `found (${activeAgent.name})` : 'none found'}`);

      // 4. Use domain service to enrich tools with authentication
      const enrichedTools = this.toolConfigurationService.enrichWithAuthentication(
        command.tools,
        activeAgent?.apiKey?.value || ''
      );

      return {
        success: true,
        data: {
          enrichedTools,
          agentFound: !!activeAgent,
          agentApiKeyProvided: !!activeAgent?.apiKey
        }
      };

    } catch (error) {
      console.error('[ToolConfigurationApplicationService] Failed to enrich tools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrich tools with authentication'
      };
    }
  }

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
      console.error('[ToolConfigurationApplicationService] Failed to validate tools:', error);
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
      console.error('[ToolConfigurationApplicationService] Failed to get auth requirements:', error);
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
        console.log('[ToolConfigurationApplicationService] No user API key provided');
        return {
          success: true,
          data: {
            enrichedTools: command.tools, // Return original tools without enrichment
            userApiKeyProvided: false
          }
        };
      }

      console.log(`[ToolConfigurationApplicationService] Enriching ${command.tools.length} tools with user API key`);

      // 2. Use domain service to enrich tools with user API key
      const enrichedTools = this.toolConfigurationService.enrichWithAuthentication(
        command.tools,
        command.userApiKey
      );

      console.log(`[ToolConfigurationApplicationService] Successfully enriched tools with user API key`);

      return {
        success: true,
        data: {
          enrichedTools,
          userApiKeyProvided: true
        }
      };

    } catch (error) {
      console.error('[ToolConfigurationApplicationService] Failed to enrich tools with user API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrich tools with user API key'
      };
    }
  }

  /**
   * Enrich tool configurations with agent API key
   *
   * Use Case: Agent wants to execute tools using the agent's own API key (not user's).
   * This service enriches tools with the agent's API key for OAuth proxy access in agent mode.
   * The OAuth proxy will use the agent owner's credentials instead of user credentials.
   *
   * @param command - Command containing tools to enrich and agent API key
   * @returns Result with enriched tools using agent API key
   */
  async enrichToolsWithAgentApiKey(command: EnrichToolsWithAgentApiKeyCommand): Promise<Result<EnrichToolsWithAgentApiKeyResult>> {
    try {
      // 1. Validate input
      if (!command.tools || command.tools.length === 0) {
        return {
          success: true,
          data: {
            enrichedTools: [],
            agentApiKeyProvided: false
          }
        };
      }

      if (!command.agentApiKey) {
        console.log('[ToolConfigurationApplicationService] No agent API key provided');
        return {
          success: true,
          data: {
            enrichedTools: command.tools, // Return original tools without enrichment
            agentApiKeyProvided: false
          }
        };
      }

      console.log(`[ToolConfigurationApplicationService] Enriching ${command.tools.length} tools with agent API key (mode: agent)`);

      // 2. Enrich tools with agent API key and agent mode
      const enrichedTools = command.tools.map(tool => {
        const config = tool.config as any;

        // If tool already has authentication, preserve it
        if (config.api_key || config.oauth_token) {
          return tool;
        }

        // Add API key with agent mode for OAuth proxy
        return tool.withConfig({
          api_key: command.agentApiKey,
          api_key_mode: 'agent'  // KEY DIFFERENCE: Agent mode uses agent owner's credentials
        });
      });

      console.log(`[ToolConfigurationApplicationService] Successfully enriched ${enrichedTools.length} tools with agent API key`);

      return {
        success: true,
        data: {
          enrichedTools,
          agentApiKeyProvided: true
        }
      };

    } catch (error) {
      console.error('[ToolConfigurationApplicationService] Failed to enrich tools with agent API key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrich tools with agent API key'
      };
    }
  }
}