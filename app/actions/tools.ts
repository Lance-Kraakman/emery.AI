'use server'

// AIDEV-NOTE: Tool Server Actions - DDD-based actions for tool selection and management
// Provides proper domain integration for frontend tool components

import { requireAuth } from "./permissions";
import { OrganizationId } from "@/ddd/domain/shared/value-objects";
import { ToolMapper, type ToolDTO, type ToolCategoryDTO, type ToolSelectionDTO } from "@/app/mappers/tool-mapper";
import { ConnectionMapper, type ConnectionDTO } from "@/app/mappers/connection-mapper";
import { getUserOAuthConnections } from "./connections";
import { getConnectionApplicationService } from "@/ddd/application/di/container";
import type { Result } from "./types";

/**
 * Get available tools for the current user's organization
 * Includes connection status for OAuth-based tools
 */
export async function getAvailableTools(): Promise<Result<ToolSelectionDTO>> {
  try {
    const session = await requireAuth();
    const organizationId = OrganizationId.fromNumber(session.user.currentOrganizationId);

    console.log(`[ToolActions] Getting available tools for organization ${organizationId.value}`);

    // Get user's OAuth connections for status integration
    const connectionsResult = await getUserOAuthConnections();
    const connections: ConnectionDTO[] = connectionsResult.success ? connectionsResult.data || [] : [];

    // For now, create sample tools since we don't have a ToolApplicationService yet
    // TODO: Replace with actual domain service once tool domain is implemented
    const sampleTools = createSampleTools();

    // Convert domain tools to DTOs with connection status
    const toolDTOs = ToolMapper.toDTOArray(sampleTools, connections);

    // Create category organization
    const availableCategories = ToolMapper.createCategoryDTOs(toolDTOs);

    console.log(`[ToolActions] Retrieved ${toolDTOs.length} tools in ${availableCategories.length} categories`);

    return {
      success: true,
      data: {
        selectedTools: [], // No tools selected initially
        availableCategories,
        isLoading: false
      }
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting available tools:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage.includes('Authentication required')
        ? 'Authentication required'
        : 'Failed to fetch tools'
    };
  }
}

/**
 * Get tools that require specific connections (for validation)
 * Used by chat system to validate tool availability before use
 */
export async function getToolsRequiringConnections(toolNames: string[]): Promise<Result<{
  toolName: string;
  appName: string;
  connected: boolean;
}[]>> {
  try {
    const session = await requireAuth();
    console.log(`[ToolActions] Checking connection requirements for tools:`, toolNames);

    // Get user's connections
    const connectionsResult = await getUserOAuthConnections();
    const connections: ConnectionDTO[] = connectionsResult.success ? connectionsResult.data || [] : [];

    // Map tool names to connection requirements
    const toolRequirements = toolNames.map(toolName => {
      const appName = extractAppNameFromToolName(toolName);
      const connected = appName ? connections.some(c => c.app === appName && c.status === 'connected') : true;

      return {
        toolName,
        appName: appName || '',
        connected
      };
    });

    const missingCount = toolRequirements.filter(t => !t.connected).length;
    console.log(`[ToolActions] ${missingCount}/${toolNames.length} tools missing connections`);

    return {
      success: true,
      data: toolRequirements
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error checking tool connections:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check tool connections'
    };
  }
}

/**
 * Validate tool selection (check if tools can be used)
 * Returns validation results and missing connection information
 */
export async function validateToolSelection(toolDTOs: ToolDTO[]): Promise<Result<{
  valid: ToolDTO[];
  invalid: ToolDTO[];
  missingConnections: string[];
}>> {
  try {
    const session = await requireAuth();
    const connectionService = getConnectionApplicationService();

    console.log(`[ToolActions] Validating ${toolDTOs.length} selected tools`);

    const valid: ToolDTO[] = [];
    const invalid: ToolDTO[] = [];
    const missingConnections: string[] = [];

    // Check each tool's requirements
    for (const tool of toolDTOs) {
      if (!tool.requiresConnection) {
        // Tool doesn't need connection, always valid
        valid.push(tool);
        continue;
      }

      if (!tool.appName) {
        // Tool requires connection but no app name configured
        invalid.push(tool);
        continue;
      }

      try {
        // Check if user has active connection for this app
        const canUse = await connectionService.canUseApp(
          { fromString: () => ({ value: session.user.id }) } as any,
          { fromString: () => ({ value: tool.appName }) } as any
        );

        if (canUse) {
          valid.push(tool);
        } else {
          invalid.push(tool);
          if (!missingConnections.includes(tool.appName)) {
            missingConnections.push(tool.appName);
          }
        }
      } catch (error) {
        console.error(`[ToolActions] Error checking connection for ${tool.appName}:`, error);
        invalid.push(tool);
      }
    }

    console.log(`[ToolActions] Validation complete: ${valid.length} valid, ${invalid.length} invalid`);

    return {
      success: true,
      data: { valid, invalid, missingConnections }
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error validating tool selection:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to validate tools'
    };
  }
}

/**
 * Get tools by category (for lazy loading)
 */
export async function getToolsByCategory(categoryName: string): Promise<Result<ToolCategoryDTO>> {
  try {
    const session = await requireAuth();
    console.log(`[ToolActions] Getting tools for category: ${categoryName}`);

    // Get all tools and filter by category
    const allToolsResult = await getAvailableTools();
    if (!allToolsResult.success || !allToolsResult.data) {
      return { success: false, error: allToolsResult.error || 'Failed to get tools' };
    }

    const category = allToolsResult.data.availableCategories.find(c => c.name === categoryName);
    if (!category) {
      return { success: false, error: `Category ${categoryName} not found` };
    }

    console.log(`[ToolActions] Found ${category.tools.length} tools in ${categoryName} category`);

    return {
      success: true,
      data: category
    };
  } catch (error: unknown) {
    console.error('[ToolActions] Error getting tools by category:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get category tools'
    };
  }
}

// AIDEV-NOTE: Temporary sample tool creation until ToolApplicationService is implemented
// This should be replaced with actual domain service integration
function createSampleTools() {
  return [
    // Reference tools (documents/files)
    {
      name: 'document_reader',
      version: '1.0',
      config: {
        title: 'Sales Report Q4',
        type: 'document',
        id: 'doc_1',
        reference_id: 'doc_1'
      }
    },
    {
      name: 'file_reader',
      version: '1.0',
      config: {
        title: 'Analysis.pdf',
        type: 'file',
        id: 'file_1',
        reference_id: 'file_1'
      }
    },
    // OAuth app tools
    {
      name: 'slack_send_message',
      version: '1.0',
      config: {
        title: 'Send Slack Message',
        app: 'slack',
        type: 'oauth_app'
      }
    },
    {
      name: 'gmail_send_email',
      version: '1.0',
      config: {
        title: 'Send Gmail Email',
        app: 'gmail',
        type: 'oauth_app'
      }
    },
    // Utility tools
    {
      name: 'data_analyzer',
      version: '1.0',
      config: {
        title: 'Analyze Data',
        type: 'utility'
      }
    },
    // Integration tools
    {
      name: 'pipedream_webhook',
      version: '1.0',
      config: {
        title: 'Trigger Webhook',
        app: 'pipedream',
        type: 'webhook'
      }
    }
  ];
}

function extractAppNameFromToolName(toolName: string): string | undefined {
  const name = toolName.toLowerCase();
  if (name.includes('slack')) return 'slack';
  if (name.includes('gmail')) return 'gmail';
  if (name.includes('github')) return 'github';
  if (name.includes('discord')) return 'discord';
  if (name.includes('twitter')) return 'twitter';
  if (name.includes('sheets')) return 'google-sheets';
  return undefined;
}