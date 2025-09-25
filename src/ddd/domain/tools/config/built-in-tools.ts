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
    method?: string; // For CRUD tools - specifies which operation (create, read, update, delete, list)
    requires_auth: boolean;
    requires_pipedream_oauth?: boolean; // Distinguish internal auth from external OAuth
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
      requires_auth: false,
      requires_pipedream_oauth: false
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
      requires_auth: false,
      requires_pipedream_oauth: false
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
 * These tools allow agents to interact with organization data through emery-api
 * All tools use internal authentication and call back to emery-api with RLS context
 */
const REFERENCE_TOOLS: BuiltInToolConfig[] = [
  // Agent CRUD Tools
  {
    id: 'agent_create',
    display_name: 'Create Agent',
    description: 'Create a new AI agent in your organization',
    category: 'agent',
    app: 'emery',
    tags: ['agent', 'create', 'ai', 'automation'],
    ui_config: {
      icon: '🤖',
      insert_text: '@tool:agent_create',
      supports_artifacts: false,
      preview_description: 'Create new AI agents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'AgentCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      name: {
        type: 'string',
        description: 'Agent name',
        required: true
      },
      description: {
        type: 'string',
        description: 'Agent description',
        required: false
      }
    }
  },
  {
    id: 'agent_read',
    display_name: 'Read Agent',
    description: 'Get details about an AI agent',
    category: 'agent',
    app: 'emery',
    tags: ['agent', 'read', 'details', 'info'],
    ui_config: {
      icon: '🤖',
      insert_text: '@tool:agent_read',
      supports_artifacts: false,
      preview_description: 'Read agent details'
    },
    implementation: {
      type: 'reference',
      backend_class: 'AgentCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      agent_id: {
        type: 'string',
        description: 'Agent ID',
        required: true
      }
    }
  },
  {
    id: 'agent_update',
    display_name: 'Update Agent',
    description: 'Update an existing AI agent configuration',
    category: 'agent',
    app: 'emery',
    tags: ['agent', 'update', 'modify', 'edit'],
    ui_config: {
      icon: '🤖',
      insert_text: '@tool:agent_update',
      supports_artifacts: false,
      preview_description: 'Update agent configuration'
    },
    implementation: {
      type: 'reference',
      backend_class: 'AgentCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      agent_id: {
        type: 'string',
        description: 'Agent ID',
        required: true
      },
      name: {
        type: 'string',
        description: 'New agent name',
        required: false
      },
      description: {
        type: 'string',
        description: 'New agent description',
        required: false
      }
    }
  },
  {
    id: 'agent_delete',
    display_name: 'Delete Agent',
    description: 'Delete an AI agent from your organization',
    category: 'agent',
    app: 'emery',
    tags: ['agent', 'delete', 'remove'],
    ui_config: {
      icon: '🤖',
      insert_text: '@tool:agent_delete',
      supports_artifacts: false,
      preview_description: 'Delete AI agents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'AgentCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      agent_id: {
        type: 'string',
        description: 'Agent ID',
        required: true
      }
    }
  },
  {
    id: 'agent_list',
    display_name: 'List Agents',
    description: 'List all AI agents in your organization',
    category: 'agent',
    app: 'emery',
    tags: ['agent', 'list', 'browse', 'all'],
    ui_config: {
      icon: '🤖',
      insert_text: '@tool:agent_list',
      supports_artifacts: true,
      preview_description: 'List all agents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'AgentCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      limit: {
        type: 'number',
        description: 'Maximum number of agents to return',
        required: false
      }
    }
  },

  // Document CRUD Tools
  {
    id: 'document_create',
    display_name: 'Create Document',
    description: 'Create a new document in your organization',
    category: 'document',
    app: 'emery',
    tags: ['document', 'create', 'write', 'content'],
    ui_config: {
      icon: '📄',
      insert_text: '@tool:document_create',
      supports_artifacts: false,
      preview_description: 'Create new documents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      title: {
        type: 'string',
        description: 'Document title',
        required: true
      },
      content: {
        type: 'string',
        description: 'Document content',
        required: true
      }
    }
  },
  {
    id: 'document_read',
    display_name: 'Read Document',
    description: 'Read content from an organization document',
    category: 'document',
    app: 'emery',
    tags: ['document', 'read', 'content', 'view'],
    ui_config: {
      icon: '📄',
      insert_text: '@tool:document_read',
      supports_artifacts: true,
      preview_description: 'Read document content'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      document_id: {
        type: 'string',
        description: 'Document ID',
        required: true
      }
    }
  },
  {
    id: 'document_update',
    display_name: 'Update Document',
    description: 'Update content of an existing document',
    category: 'document',
    app: 'emery',
    tags: ['document', 'update', 'edit', 'modify'],
    ui_config: {
      icon: '📄',
      insert_text: '@tool:document_update',
      supports_artifacts: false,
      preview_description: 'Update document content'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      document_id: {
        type: 'string',
        description: 'Document ID',
        required: true
      },
      content: {
        type: 'string',
        description: 'New document content',
        required: false
      },
      title: {
        type: 'string',
        description: 'New document title',
        required: false
      }
    }
  },
  {
    id: 'document_delete',
    display_name: 'Delete Document',
    description: 'Delete a document from your organization',
    category: 'document',
    app: 'emery',
    tags: ['document', 'delete', 'remove'],
    ui_config: {
      icon: '📄',
      insert_text: '@tool:document_delete',
      supports_artifacts: false,
      preview_description: 'Delete documents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      document_id: {
        type: 'string',
        description: 'Document ID',
        required: true
      }
    }
  },
  {
    id: 'document_list',
    display_name: 'List Documents',
    description: 'List all documents in your organization',
    category: 'document',
    app: 'emery',
    tags: ['document', 'list', 'browse', 'all'],
    ui_config: {
      icon: '📄',
      insert_text: '@tool:document_list',
      supports_artifacts: true,
      preview_description: 'List all documents'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DocumentCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      limit: {
        type: 'number',
        description: 'Maximum number of documents to return',
        required: false
      }
    }
  },

  // File CRUD Tools
  {
    id: 'file_create',
    display_name: 'Create File',
    description: 'Upload or create a new file in your organization',
    category: 'file',
    app: 'emery',
    tags: ['file', 'create', 'upload', 'storage'],
    ui_config: {
      icon: '📁',
      insert_text: '@tool:file_create',
      supports_artifacts: false,
      preview_description: 'Create or upload files'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      filename: {
        type: 'string',
        description: 'File name',
        required: true
      },
      content: {
        type: 'string',
        description: 'File content or base64 encoded data',
        required: true
      },
      folder_path: {
        type: 'string',
        description: 'Folder path (optional)',
        required: false
      }
    }
  },
  {
    id: 'file_read',
    display_name: 'Read File',
    description: 'Read content from an organization file',
    category: 'file',
    app: 'emery',
    tags: ['file', 'read', 'download', 'content'],
    ui_config: {
      icon: '📁',
      insert_text: '@tool:file_read',
      supports_artifacts: true,
      preview_description: 'Read file content'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      file_id: {
        type: 'string',
        description: 'File ID',
        required: true
      }
    }
  },
  {
    id: 'file_update',
    display_name: 'Update File',
    description: 'Update content of an existing file',
    category: 'file',
    app: 'emery',
    tags: ['file', 'update', 'edit', 'modify'],
    ui_config: {
      icon: '📁',
      insert_text: '@tool:file_update',
      supports_artifacts: false,
      preview_description: 'Update file content'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      file_id: {
        type: 'string',
        description: 'File ID',
        required: true
      },
      content: {
        type: 'string',
        description: 'New file content',
        required: false
      },
      filename: {
        type: 'string',
        description: 'New file name',
        required: false
      }
    }
  },
  {
    id: 'file_delete',
    display_name: 'Delete File',
    description: 'Delete a file from your organization storage',
    category: 'file',
    app: 'emery',
    tags: ['file', 'delete', 'remove'],
    ui_config: {
      icon: '📁',
      insert_text: '@tool:file_delete',
      supports_artifacts: false,
      preview_description: 'Delete files'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      file_id: {
        type: 'string',
        description: 'File ID',
        required: true
      }
    }
  },
  {
    id: 'file_list',
    display_name: 'List Files',
    description: 'List all files in your organization storage',
    category: 'file',
    app: 'emery',
    tags: ['file', 'list', 'browse', 'storage'],
    ui_config: {
      icon: '📁',
      insert_text: '@tool:file_list',
      supports_artifacts: true,
      preview_description: 'List all files'
    },
    implementation: {
      type: 'reference',
      backend_class: 'FileCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      folder_path: {
        type: 'string',
        description: 'Folder path to list (optional)',
        required: false
      },
      limit: {
        type: 'number',
        description: 'Maximum number of files to return',
        required: false
      }
    }
  },

  // Table CRUD Tools
  {
    id: 'table_create',
    display_name: 'Create Table',
    description: 'Create a new data table in your organization',
    category: 'table',
    app: 'emery',
    tags: ['table', 'create', 'database', 'data'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_create',
      supports_artifacts: false,
      preview_description: 'Create new data tables'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      table_name: {
        type: 'string',
        description: 'Table name',
        required: true
      },
      schema: {
        type: 'object',
        description: 'Table schema definition',
        required: true
      }
    }
  },
  {
    id: 'table_read',
    display_name: 'Read Table',
    description: 'Read data from an organization table',
    category: 'table',
    app: 'emery',
    tags: ['table', 'read', 'data', 'query'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_read',
      supports_artifacts: true,
      preview_description: 'Read table data'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      table_id: {
        type: 'string',
        description: 'Table ID',
        required: true
      },
      limit: {
        type: 'number',
        description: 'Maximum number of rows to return',
        required: false
      }
    }
  },
  {
    id: 'table_update',
    display_name: 'Update Table',
    description: 'Update data in an organization table',
    category: 'table',
    app: 'emery',
    tags: ['table', 'update', 'edit', 'data'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_update',
      supports_artifacts: false,
      preview_description: 'Update table data'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      table_id: {
        type: 'string',
        description: 'Table ID',
        required: true
      },
      row_data: {
        type: 'object',
        description: 'Data to update',
        required: true
      }
    }
  },
  {
    id: 'table_delete',
    display_name: 'Delete Table',
    description: 'Delete a table from your organization',
    category: 'table',
    app: 'emery',
    tags: ['table', 'delete', 'remove'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_delete',
      supports_artifacts: false,
      preview_description: 'Delete tables'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      table_id: {
        type: 'string',
        description: 'Table ID',
        required: true
      }
    }
  },
  {
    id: 'table_query',
    display_name: 'Query Table',
    description: 'Run advanced queries on organization table data',
    category: 'table',
    app: 'emery',
    tags: ['table', 'query', 'search', 'filter'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_query',
      supports_artifacts: true,
      preview_description: 'Query table data'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'query',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      table_id: {
        type: 'string',
        description: 'Table ID',
        required: true
      },
      query: {
        type: 'string',
        description: 'Query expression',
        required: true
      }
    }
  },
  {
    id: 'table_list',
    display_name: 'List Tables',
    description: 'List all tables in your organization',
    category: 'table',
    app: 'emery',
    tags: ['table', 'list', 'browse', 'all'],
    ui_config: {
      icon: '📊',
      insert_text: '@tool:table_list',
      supports_artifacts: true,
      preview_description: 'List all tables'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TableCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      limit: {
        type: 'number',
        description: 'Maximum number of tables to return',
        required: false
      }
    }
  },

  // Team CRUD Tools
  {
    id: 'team_create',
    display_name: 'Create Team',
    description: 'Create a new team in your organization',
    category: 'team',
    app: 'emery',
    tags: ['team', 'create', 'collaboration', 'group'],
    ui_config: {
      icon: '👥',
      insert_text: '@tool:team_create',
      supports_artifacts: false,
      preview_description: 'Create new teams'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TeamCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      name: {
        type: 'string',
        description: 'Team name',
        required: true
      },
      description: {
        type: 'string',
        description: 'Team description',
        required: false
      }
    }
  },
  {
    id: 'team_read',
    display_name: 'Read Team',
    description: 'Get details about a team',
    category: 'team',
    app: 'emery',
    tags: ['team', 'read', 'details', 'members'],
    ui_config: {
      icon: '👥',
      insert_text: '@tool:team_read',
      supports_artifacts: false,
      preview_description: 'Read team details'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TeamCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      team_id: {
        type: 'string',
        description: 'Team ID',
        required: true
      }
    }
  },
  {
    id: 'team_update',
    display_name: 'Update Team',
    description: 'Update team configuration and membership',
    category: 'team',
    app: 'emery',
    tags: ['team', 'update', 'edit', 'members'],
    ui_config: {
      icon: '👥',
      insert_text: '@tool:team_update',
      supports_artifacts: false,
      preview_description: 'Update team configuration'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TeamCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      team_id: {
        type: 'string',
        description: 'Team ID',
        required: true
      },
      name: {
        type: 'string',
        description: 'New team name',
        required: false
      },
      description: {
        type: 'string',
        description: 'New team description',
        required: false
      }
    }
  },
  {
    id: 'team_delete',
    display_name: 'Delete Team',
    description: 'Delete a team from your organization',
    category: 'team',
    app: 'emery',
    tags: ['team', 'delete', 'remove'],
    ui_config: {
      icon: '👥',
      insert_text: '@tool:team_delete',
      supports_artifacts: false,
      preview_description: 'Delete teams'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TeamCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      team_id: {
        type: 'string',
        description: 'Team ID',
        required: true
      }
    }
  },
  {
    id: 'team_list',
    display_name: 'List Teams',
    description: 'List all teams in your organization',
    category: 'team',
    app: 'emery',
    tags: ['team', 'list', 'browse', 'all'],
    ui_config: {
      icon: '👥',
      insert_text: '@tool:team_list',
      supports_artifacts: true,
      preview_description: 'List all teams'
    },
    implementation: {
      type: 'reference',
      backend_class: 'TeamCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      limit: {
        type: 'number',
        description: 'Maximum number of teams to return',
        required: false
      }
    }
  },

  // Database CRUD Tools
  {
    id: 'database_create',
    display_name: 'Create Database',
    description: 'Create a new database in your organization',
    category: 'database',
    app: 'emery',
    tags: ['database', 'create', 'new', 'setup'],
    ui_config: {
      icon: '🗄️',
      insert_text: '@tool:database_create',
      supports_artifacts: false,
      preview_description: 'Create new database'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DatabaseCrudTool',
      method: 'create',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      name: {
        type: 'string',
        description: 'Database name',
        required: true
      },
      description: {
        type: 'string',
        description: 'Database description',
        required: false
      }
    }
  },
  {
    id: 'database_read',
    display_name: 'Read Database',
    description: 'Get details about a database',
    category: 'database',
    app: 'emery',
    tags: ['database', 'read', 'details', 'info'],
    ui_config: {
      icon: '🗄️',
      insert_text: '@tool:database_read',
      supports_artifacts: false,
      preview_description: 'Read database details'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DatabaseCrudTool',
      method: 'read',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      database_id: {
        type: 'string',
        description: 'Database ID',
        required: true
      }
    }
  },
  {
    id: 'database_update',
    display_name: 'Update Database',
    description: 'Update database configuration and settings',
    category: 'database',
    app: 'emery',
    tags: ['database', 'update', 'edit', 'modify'],
    ui_config: {
      icon: '🗄️',
      insert_text: '@tool:database_update',
      supports_artifacts: false,
      preview_description: 'Update database'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DatabaseCrudTool',
      method: 'update',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      database_id: {
        type: 'string',
        description: 'Database ID',
        required: true
      },
      data: {
        type: 'object',
        description: 'Updated database data',
        required: true
      }
    }
  },
  {
    id: 'database_delete',
    display_name: 'Delete Database',
    description: 'Delete a database from your organization',
    category: 'database',
    app: 'emery',
    tags: ['database', 'delete', 'remove', 'destroy'],
    ui_config: {
      icon: '🗄️',
      insert_text: '@tool:database_delete',
      supports_artifacts: false,
      preview_description: 'Delete database'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DatabaseCrudTool',
      method: 'delete',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      database_id: {
        type: 'string',
        description: 'Database ID',
        required: true
      }
    }
  },
  {
    id: 'database_list',
    display_name: 'List Databases',
    description: 'List all databases in your organization',
    category: 'database',
    app: 'emery',
    tags: ['database', 'list', 'browse', 'all'],
    ui_config: {
      icon: '🗄️',
      insert_text: '@tool:database_list',
      supports_artifacts: true,
      preview_description: 'List all databases'
    },
    implementation: {
      type: 'reference',
      backend_class: 'DatabaseCrudTool',
      method: 'list',
      requires_auth: true,
      requires_pipedream_oauth: false
    },
    parameters: {
      limit: {
        type: 'number',
        description: 'Maximum number of databases to return',
        required: false
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