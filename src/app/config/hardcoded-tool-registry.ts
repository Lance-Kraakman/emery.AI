/**
 * Hardcoded Tool Registry
 *
 * AIDEV-NOTE: Static tool registry based on emery_agents tools.
 * This provides a hardcoded list of available tools without dynamic discovery.
 * Based on emery-agents/src/emery_agents/execution/tools/tool_registry.py
 */

import { ToolConfig } from '@/src/ddd/domain/tools/value-objects/tool-config'
import { ToolMetadata, ToolCategory, ConnectionType } from '@/src/ddd/domain/tools/value-objects/tool-metadata'
import type { ReferenceTool } from '@/src/ddd/domain/tools/entities/reference-tool'

/**
 * Tool definition for registry
 */
interface ToolDefinition {
  name: string
  version: string
  displayName: string
  description: string
  category: string
  requiresConnection: boolean
  connectionType: ConnectionType
  tags: string[]
}

/**
 * Base tools from emery-agents/src/emery_agents/execution/tools/base_tools.py
 */
const BASE_TOOLS: ToolDefinition[] = [
  {
    name: 'python_repl',
    version: '1.0',
    displayName: 'Python REPL',
    description: 'Execute Python code in a sandboxed environment',
    category: 'base',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['python', 'code', 'execution']
  },
  {
    name: 'web_search',
    version: '1.0',
    displayName: 'Web Search',
    description: 'Search the web for information',
    category: 'utilities',
    requiresConnection: true,
    connectionType: ConnectionType.API_KEY,
    tags: ['search', 'web', 'information']
  },
  {
    name: 'file_reader',
    version: '1.0',
    displayName: 'File Reader',
    description: 'Read and analyze files',
    category: 'base',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['file', 'read', 'analyze']
  },
  {
    name: 'calculator',
    version: '1.0',
    displayName: 'Calculator',
    description: 'Perform mathematical calculations',
    category: 'utilities',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['math', 'calculation', 'numbers']
  }
]

/**
 * Email tools from emery-agents/src/emery_agents/execution/tools/email_tools.py
 */
const EMAIL_TOOLS: ToolDefinition[] = [
  {
    name: 'send_email',
    version: '1.0',
    displayName: 'Send Email',
    description: 'Send emails via SMTP',
    category: 'apps',
    requiresConnection: true,
    connectionType: ConnectionType.API_KEY,
    tags: ['email', 'send', 'communication']
  },
  {
    name: 'read_emails',
    version: '1.0',
    displayName: 'Read Emails',
    description: 'Read emails from inbox',
    category: 'apps',
    requiresConnection: true,
    connectionType: ConnectionType.OAUTH,
    tags: ['email', 'read', 'inbox']
  }
]

/**
 * Data tools from emery-agents/src/emery_agents/execution/tools/data_tools.py
 */
const DATA_TOOLS: ToolDefinition[] = [
  {
    name: 'query_database',
    version: '1.0',
    displayName: 'Query Database',
    description: 'Execute SQL queries on databases',
    category: 'base',
    requiresConnection: true,
    connectionType: ConnectionType.API_KEY,
    tags: ['database', 'sql', 'query']
  },
  {
    name: 'csv_processor',
    version: '1.0',
    displayName: 'CSV Processor',
    description: 'Process and analyze CSV files',
    category: 'base',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['csv', 'data', 'process']
  },
  {
    name: 'json_processor',
    version: '1.0',
    displayName: 'JSON Processor',
    description: 'Process and manipulate JSON data',
    category: 'base',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['json', 'data', 'process']
  }
]

/**
 * Organizational tools from emery-agents/src/emery_agents/execution/tools/organizational_tools.py
 */
const ORGANIZATIONAL_TOOLS: ToolDefinition[] = [
  {
    name: 'calendar_manager',
    version: '1.0',
    displayName: 'Calendar Manager',
    description: 'Manage calendar events and scheduling',
    category: 'organizational',
    requiresConnection: true,
    connectionType: ConnectionType.OAUTH,
    tags: ['calendar', 'scheduling', 'events']
  },
  {
    name: 'task_manager',
    version: '1.0',
    displayName: 'Task Manager',
    description: 'Create and manage tasks',
    category: 'organizational',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['tasks', 'todo', 'management']
  },
  {
    name: 'document_generator',
    version: '1.0',
    displayName: 'Document Generator',
    description: 'Generate documents from templates',
    category: 'organizational',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['documents', 'templates', 'generation']
  }
]

/**
 * API tools from emery-agents/src/emery_agents/execution/tools/api_tools.py
 */
const API_TOOLS: ToolDefinition[] = [
  {
    name: 'rest_api_client',
    version: '1.0',
    displayName: 'REST API Client',
    description: 'Make HTTP requests to REST APIs',
    category: 'apps',
    requiresConnection: true,
    connectionType: ConnectionType.API_KEY,
    tags: ['api', 'rest', 'http']
  },
  {
    name: 'webhook_sender',
    version: '1.0',
    displayName: 'Webhook Sender',
    description: 'Send webhook notifications',
    category: 'apps',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['webhook', 'notifications', 'integration']
  }
]

/**
 * Pipedream tools from emery-agents/src/emery_agents/execution/tools/pipedream_tools.py
 */
const PIPEDREAM_TOOLS: ToolDefinition[] = [
  {
    name: 'pipedream_trigger',
    version: '1.0',
    displayName: 'Pipedream Trigger',
    description: 'Trigger Pipedream workflows',
    category: 'apps',
    requiresConnection: true,
    connectionType: ConnectionType.OAUTH,
    tags: ['pipedream', 'workflow', 'automation']
  },
  {
    name: 'pipedream_connector',
    version: '1.0',
    displayName: 'Pipedream Connector',
    description: 'Connect to Pipedream services',
    category: 'apps',
    requiresConnection: true,
    connectionType: ConnectionType.OAUTH,
    tags: ['pipedream', 'connector', 'services']
  }
]

/**
 * Reference tools that need to be created
 */
const REFERENCE_TOOLS: ToolDefinition[] = [
  {
    name: 'agent_reference',
    version: '1.0',
    displayName: 'Agent Reference',
    description: 'Reference to AI agents',
    category: 'references',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['agent', 'reference', 'ai']
  },
  {
    name: 'document_reference',
    version: '1.0',
    displayName: 'Document Reference',
    description: 'Reference to documents',
    category: 'references',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['document', 'reference', 'file']
  },
  {
    name: 'file_reference',
    version: '1.0',
    displayName: 'File Reference',
    description: 'Reference to files',
    category: 'references',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['file', 'reference', 'attachment']
  },
  {
    name: 'table_reference',
    version: '1.0',
    displayName: 'Table Reference',
    description: 'Reference to data tables',
    category: 'references',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['table', 'reference', 'data']
  },
  {
    name: 'database_reference',
    version: '1.0',
    displayName: 'Database Reference',
    description: 'Reference to databases',
    category: 'references',
    requiresConnection: false,
    connectionType: ConnectionType.NONE,
    tags: ['database', 'reference', 'storage']
  }
]

/**
 * All available tools
 */
export const ALL_TOOLS: ToolDefinition[] = [
  ...BASE_TOOLS,
  ...EMAIL_TOOLS,
  ...DATA_TOOLS,
  ...ORGANIZATIONAL_TOOLS,
  ...API_TOOLS,
  ...PIPEDREAM_TOOLS,
  ...REFERENCE_TOOLS
]

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): ToolDefinition[] {
  return ALL_TOOLS.filter(tool => tool.category === category)
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return ALL_TOOLS.find(tool => tool.name === name)
}

/**
 * Get all tool names
 */
export function getAllToolNames(): string[] {
  return ALL_TOOLS.map(tool => tool.name)
}

/**
 * Convert tool definition to ToolConfig and ToolMetadata
 */
export function createToolFromDefinition(definition: ToolDefinition): {
  config: ToolConfig
  metadata: ToolMetadata
} {
  // Create basic tool config (not reference tool)
  const config = ToolConfig.basic(definition.name, {})

  // Map category string to ToolCategory enum
  let toolCategory: ToolCategory
  switch (definition.category) {
    case 'references':
      toolCategory = ToolCategory.REFERENCES
      break
    case 'base':
      toolCategory = ToolCategory.BASE
      break
    case 'apps':
      toolCategory = ToolCategory.APPS
      break
    case 'organizational':
      toolCategory = ToolCategory.ORGANIZATIONAL
      break
    case 'utilities':
      toolCategory = ToolCategory.UTILITIES
      break
    default:
      toolCategory = ToolCategory.BASE
  }

  const metadata = new ToolMetadata(
    definition.name,
    definition.displayName,
    definition.description,
    toolCategory,
    definition.requiresConnection,
    definition.connectionType,
    [], // requiredApps - empty for hardcoded tools for now
    undefined, // icon
    definition.tags
  )

  return { config, metadata }
}

/**
 * Get all available tools as ToolConfig + ToolMetadata pairs
 */
export function getAllToolConfigs(): Array<{ config: ToolConfig; metadata: ToolMetadata }> {
  return ALL_TOOLS.map(createToolFromDefinition)
}