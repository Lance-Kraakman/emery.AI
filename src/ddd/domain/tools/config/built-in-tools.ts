/**
 * Built-in System and Reference Tools Configuration
 *
 * Static configuration for system tools and reference tools that are built into Emery.
 * These tools have stub implementations in the backend and provide core functionality.
 *
 * AIDEV-NOTE: Centralized tool definitions with type safety.
 * No file I/O dependencies - imported at build time.
 */

export interface BuiltInToolConfig {
  id: string;
  display_name: string;
  description: string;
  category: string;
  app: string;
  tags: string[];
  ui_config: {
    icon: string;
    insert_text: string;
    supports_artifacts?: boolean;
    preview_description?: string;
  };
  implementation: {
    type: string;
    backend_class: string;
    requires_auth: boolean;
  };
  parameters: {
    [key: string]: {
      type: string;
      description: string;
      required: boolean;
    };
  };
}

/**
 * System Tools - Core functionality provided by Emery
 */
const SYSTEM_TOOLS: BuiltInToolConfig[] = [
  {
    id: 'python_repl',
    display_name: 'Python REPL',
    description: 'Execute Python code in a sandboxed environment',
    category: 'utility',
    app: 'emery',
    tags: ['python', 'code', 'execution', 'calculation'],
    ui_config: {
      icon: '🐍',
      insert_text: '@tool:python_repl',
      supports_artifacts: true,
      preview_description: 'Run Python code and see results'
    },
    implementation: {
      type: 'system',
      backend_class: 'PythonReplTool',
      requires_auth: false
    },
    parameters: {
      code: {
        type: 'string',
        description: 'Python code to execute',
        required: true
      }
    }
  },
  {
    id: 'web_search',
    display_name: 'Web Search',
    description: 'Search the web for current information',
    category: 'reference',
    app: 'emery',
    tags: ['search', 'web', 'information', 'research'],
    ui_config: {
      icon: '🔍',
      insert_text: '@tool:web_search',
      supports_artifacts: false,
      preview_description: 'Search the web for information'
    },
    implementation: {
      type: 'system',
      backend_class: 'WebSearchTool',
      requires_auth: false
    },
    parameters: {
      query: {
        type: 'string',
        description: 'Search query',
        required: true
      }
    }
  }
];

/**
 * Reference Tools - CRUD operations for Emery data entities
 * These tools allow agents to interact with organization data
 */
const REFERENCE_TOOLS: BuiltInToolConfig[] = [
  {
    id: 'document_reader',
    display_name: 'Document Reader',
    description: 'Read documents from your organization storage',
    category: 'reference',
    app: 'emery',
    tags: ['documents', 'read', 'files', 'storage'],
    ui_config: {
      icon: '📄',
      insert_text: '@doc:',
      supports_artifacts: false,
      preview_description: 'Read organization documents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentReaderTool',
      requires_auth: true
    },
    parameters: {
      document_id: {
        type: 'string',
        description: 'Document ID to read',
        required: true
      }
    }
  },
  {
    id: 'file_reader',
    display_name: 'File Reader',
    description: 'Read files from your organization storage',
    category: 'reference',
    app: 'emery',
    tags: ['files', 'read', 'storage', 's3'],
    ui_config: {
      icon: '📁',
      insert_text: '@file:',
      supports_artifacts: false,
      preview_description: 'Read organization files'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileReaderTool',
      requires_auth: true
    },
    parameters: {
      file_path: {
        type: 'string',
        description: 'File path to read',
        required: true
      }
    }
  },
  {
    id: 'table_query',
    display_name: 'Table Query',
    description: 'Query data from organization tables',
    category: 'reference',
    app: 'emery',
    tags: ['tables', 'query', 'data', 'database'],
    ui_config: {
      icon: '📊',
      insert_text: '@table:',
      supports_artifacts: true,
      preview_description: 'Query organization table data'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableQueryTool',
      requires_auth: true
    },
    parameters: {
      table_name: {
        type: 'string',
        description: 'Table name to query',
        required: true
      }
    }
  }
];

/**
 * All built-in tools combined
 */
export const BUILT_IN_TOOLS: BuiltInToolConfig[] = [
  ...SYSTEM_TOOLS,
  ...REFERENCE_TOOLS
];

/**
 * Tool lookup by ID
 */
export const BUILT_IN_TOOLS_BY_ID = BUILT_IN_TOOLS.reduce((acc, tool) => {
  acc[tool.id] = tool;
  return acc;
}, {} as Record<string, BuiltInToolConfig>);

/**
 * Tool IDs for type safety
 */
export type BuiltInToolId = typeof BUILT_IN_TOOLS[number]['id'];

/**
 * System tool IDs (subset of all built-in tools)
 */
export const SYSTEM_TOOL_IDS = SYSTEM_TOOLS.map(tool => tool.id);

/**
 * Reference tool IDs (subset of all built-in tools)
 */
export const REFERENCE_TOOL_IDS = REFERENCE_TOOLS.map(tool => tool.id);