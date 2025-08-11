/**
 * Predefined tools registry for agent configuration
 * AIDEV-NOTE: Central registry of all supported tools for agent workflows
 */

export interface ToolDefinition {
  name: string;
  display_name: string;
  description: string;
  category: 'data' | 'communication' | 'code' | 'analysis' | 'web' | 'file' | 'ai' | 'system';
  oauth_service?: string; // Maps to OAuth connection (e.g., 'gmail', 'slack', 'github')
  requires_auth: boolean; // Whether this tool requires OAuth authentication
  parameters?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    description?: string;
    default?: any;
  }>;
  examples?: string[];
  documentation_url?: string;
}

export interface ServerDefinition {
  name: string;
  display_name: string;
  description: string;
  category: 'mcp' | 'api' | 'database' | 'service';
  endpoint?: string;
  authentication?: 'none' | 'api_key' | 'oauth' | 'custom';
  parameters?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    description?: string;
  }>;
}

/**
 * Built-in tools available for all agents
 * AIDEV-NOTE: Tools are mapped to OAuth services where authentication is required
 */
export const PREDEFINED_TOOLS: ToolDefinition[] = [
  // Gmail Tools (OAuth Required)
  {
    name: 'gmail_send_email',
    display_name: 'Send Email (Gmail)',
    description: 'Send emails through Gmail using agent owner\'s connected account',
    category: 'communication',
    oauth_service: 'gmail',
    requires_auth: true,
    parameters: [
      { name: 'to', type: 'string', required: true, description: 'Recipient email address' },
      { name: 'subject', type: 'string', required: true, description: 'Email subject' },
      { name: 'body', type: 'string', required: true, description: 'Email body content' },
      { name: 'html', type: 'boolean', required: false, default: false, description: 'Send as HTML' }
    ],
    examples: ['Send a weekly report to team@company.com']
  },
  {
    name: 'gmail_get_messages',
    display_name: 'Get Gmail Messages',
    description: 'Retrieve emails from Gmail inbox using agent owner\'s connected account',
    category: 'communication',
    oauth_service: 'gmail',
    requires_auth: true,
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Gmail search query (e.g., "is:unread from:boss@company.com")' },
      { name: 'max_results', type: 'number', required: false, default: 10, description: 'Maximum number of messages to retrieve' }
    ],
    examples: ['Get unread emails from last 7 days', 'Find emails with attachments']
  },
  
  // Slack Tools (OAuth Required)  
  {
    name: 'slack_send_message',
    display_name: 'Send Slack Message',
    description: 'Send messages to Slack channels or users using agent owner\'s connected account',
    category: 'communication',
    oauth_service: 'slack',
    requires_auth: true,
    parameters: [
      { name: 'channel', type: 'string', required: true, description: 'Slack channel or user ID (#general, @username, or ID)' },
      { name: 'text', type: 'string', required: true, description: 'Message content' },
      { name: 'thread_ts', type: 'string', required: false, description: 'Reply to thread timestamp' }
    ],
    examples: ['Send daily standup reminder to #team channel']
  },
  {
    name: 'slack_get_messages',
    display_name: 'Get Slack Messages',
    description: 'Retrieve messages from Slack channels using agent owner\'s connected account',
    category: 'communication',
    oauth_service: 'slack',
    requires_auth: true,
    parameters: [
      { name: 'channel', type: 'string', required: true, description: 'Slack channel ID' },
      { name: 'limit', type: 'number', required: false, default: 100, description: 'Number of messages to retrieve' }
    ]
  },

  // GitHub Tools (OAuth Required)
  {
    name: 'github_create_issue',
    display_name: 'Create GitHub Issue',
    description: 'Create issues in GitHub repositories using agent owner\'s connected account',
    category: 'code',
    oauth_service: 'github',
    requires_auth: true,
    parameters: [
      { name: 'repo', type: 'string', required: true, description: 'Repository name (owner/repo)' },
      { name: 'title', type: 'string', required: true, description: 'Issue title' },
      { name: 'body', type: 'string', required: false, description: 'Issue description' },
      { name: 'labels', type: 'array', required: false, description: 'Array of label names' }
    ]
  },
  {
    name: 'github_get_repos',
    display_name: 'Get GitHub Repositories',
    description: 'List GitHub repositories using agent owner\'s connected account',
    category: 'code',
    oauth_service: 'github',
    requires_auth: true,
    parameters: [
      { name: 'type', type: 'string', required: false, default: 'owner', description: 'Repository type: owner, public, private' },
      { name: 'per_page', type: 'number', required: false, default: 30, description: 'Results per page' }
    ]
  },

  // Google Sheets Tools (OAuth Required)
  {
    name: 'sheets_read_data',
    display_name: 'Read Google Sheets Data',
    description: 'Read data from Google Sheets using agent owner\'s connected account',
    category: 'data',
    oauth_service: 'google-sheets',
    requires_auth: true,
    parameters: [
      { name: 'spreadsheet_id', type: 'string', required: true, description: 'Google Sheets spreadsheet ID' },
      { name: 'range', type: 'string', required: true, description: 'Sheet range (e.g., "Sheet1!A1:D10")' }
    ]
  },
  {
    name: 'sheets_write_data',
    display_name: 'Write Google Sheets Data',
    description: 'Write data to Google Sheets using agent owner\'s connected account',
    category: 'data',
    oauth_service: 'google-sheets',
    requires_auth: true,
    parameters: [
      { name: 'spreadsheet_id', type: 'string', required: true, description: 'Google Sheets spreadsheet ID' },
      { name: 'range', type: 'string', required: true, description: 'Sheet range (e.g., "Sheet1!A1")' },
      { name: 'values', type: 'array', required: true, description: 'Array of arrays containing cell values' }
    ]
  },

  // Discord Tools (OAuth Required)
  {
    name: 'discord_send_message',
    display_name: 'Send Discord Message',
    description: 'Send messages to Discord channels using agent owner\'s connected account',
    category: 'communication',
    oauth_service: 'discord',
    requires_auth: true,
    parameters: [
      { name: 'channel_id', type: 'string', required: true, description: 'Discord channel ID' },
      { name: 'content', type: 'string', required: true, description: 'Message content' }
    ]
  },

  // Twitter Tools (OAuth Required)
  {
    name: 'twitter_post_tweet',
    display_name: 'Post Tweet',
    description: 'Post tweets using agent owner\'s connected Twitter account',
    category: 'communication',
    oauth_service: 'twitter',
    requires_auth: true,
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'Tweet content (max 280 characters)' },
      { name: 'reply_to', type: 'string', required: false, description: 'Tweet ID to reply to' }
    ]
  },

  // Data Analysis Tools (No OAuth Required)
  {
    name: 'pandas_query',
    display_name: 'Data Query (Pandas)',
    description: 'Query and manipulate data using pandas operations',
    category: 'data',
    requires_auth: false,
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Pandas query expression' },
      { name: 'data_source', type: 'string', required: false, description: 'Data source identifier' }
    ],
    examples: [
      'df[df["sales"] > 1000].groupby("region").sum()',
      'df.describe()',
      'df.pivot_table(values="revenue", index="date", columns="product")'
    ]
  },
  {
    name: 'sql_query',
    display_name: 'SQL Query',
    description: 'Execute SQL queries against Emery databases',
    category: 'data',
    requires_auth: false,
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'SQL query to execute' },
      { name: 'table_id', type: 'string', required: false, description: 'Target Emery table ID' }
    ],
    examples: [
      'SELECT * FROM dynamic_table WHERE created_at > "2024-01-01"',
      'SELECT COUNT(*) as total_records FROM dynamic_table'
    ]
  },
  
  // Code Tools
  {
    name: 'python_exec',
    display_name: 'Python Executor',
    description: 'Execute Python code with access to common libraries',
    category: 'code',
    parameters: [
      { name: 'code', type: 'string', required: true, description: 'Python code to execute' },
      { name: 'timeout', type: 'number', required: false, default: 30, description: 'Execution timeout in seconds' }
    ],
    examples: [
      'import pandas as pd\ndf = pd.read_csv("data.csv")\nprint(df.head())'
    ],
    requires_auth: false
  },
  {
    name: 'bash_command',
    display_name: 'Bash Command',
    description: 'Execute bash/shell commands',
    category: 'system',
    parameters: [
      { name: 'command', type: 'string', required: true, description: 'Bash command to execute' },
      { name: 'timeout', type: 'number', required: false, default: 30, description: 'Command timeout in seconds' },
      { name: 'working_dir', type: 'string', required: false, description: 'Working directory' }
    ],
    requires_auth: false
  },
  
  // Web Tools
  {
    name: 'web_scraper',
    display_name: 'Web Scraper',
    description: 'Extract data from web pages',
    category: 'web',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'URL to scrape' },
      { name: 'selector', type: 'string', required: false, description: 'CSS selector for specific elements' },
      { name: 'format', type: 'string', required: false, default: 'text', description: 'Output format: text, html, markdown' }
    ],
    requires_auth: false
  },
  {
    name: 'http_request',
    display_name: 'HTTP Request',
    description: 'Make HTTP requests to external APIs',
    category: 'web',
    parameters: [
      { name: 'url', type: 'string', required: true, description: 'Request URL' },
      { name: 'method', type: 'string', required: false, default: 'GET', description: 'HTTP method' },
      { name: 'headers', type: 'object', required: false, description: 'Request headers' },
      { name: 'body', type: 'object', required: false, description: 'Request body' }
    ],
    requires_auth: false
  },
  
  // File Tools
  {
    name: 'read_file',
    display_name: 'Read File',
    description: 'Read contents from files',
    category: 'file',
    parameters: [
      { name: 'path', type: 'string', required: true, description: 'File path to read' },
      { name: 'encoding', type: 'string', required: false, default: 'utf-8', description: 'File encoding' }
    ],
    requires_auth: false
  },
  {
    name: 'write_file',
    display_name: 'Write File',
    description: 'Write content to files',
    category: 'file',
    parameters: [
      { name: 'path', type: 'string', required: true, description: 'File path to write' },
      { name: 'content', type: 'string', required: true, description: 'Content to write' },
      { name: 'mode', type: 'string', required: false, default: 'w', description: 'Write mode: w, a, x' }
    ],
    requires_auth: false
  },
  
  // Analysis Tools
  {
    name: 'sentiment_analysis',
    display_name: 'Sentiment Analysis',
    description: 'Analyze sentiment of text content',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'Text to analyze' },
      { name: 'model', type: 'string', required: false, description: 'Sentiment model to use' }
    ],
    requires_auth: false
  },
  {
    name: 'text_summarizer',
    display_name: 'Text Summarizer',
    description: 'Generate summaries of long text content',
    category: 'ai',
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'Text to summarize' },
      { name: 'max_length', type: 'number', required: false, default: 150, description: 'Maximum summary length' }
    ],
    requires_auth: false
  }
];

/**
 * Available MCP servers and external services
 */
export const PREDEFINED_SERVERS: ServerDefinition[] = [
  {
    name: 'emery_client',
    display_name: 'Emery Client',
    description: 'Access to Emery database and API functions',
    category: 'service',
    authentication: 'api_key',
    parameters: [
      { name: 'api_url', type: 'string', required: true, description: 'Emery API base URL' },
      { name: 'agent_id', type: 'string', required: true, description: 'Agent ID for authentication' }
    ]
  },
  {
    name: 'filesystem',
    display_name: 'File System',
    description: 'MCP server for file system operations',
    category: 'mcp',
    authentication: 'none'
  },
  {
    name: 'sqlite_db',
    display_name: 'SQLite Database',
    description: 'MCP server for SQLite database access',
    category: 'mcp',
    authentication: 'none',
    parameters: [
      { name: 'database_path', type: 'string', required: true, description: 'Path to SQLite database file' }
    ]
  },
  {
    name: 'web_browser',
    display_name: 'Web Browser',
    description: 'MCP server for web browsing and scraping',
    category: 'mcp',
    authentication: 'none'
  }
];

/**
 * Trigger type definitions
 */
export interface TriggerDefinition {
  type: 'MANUAL' | 'CRON' | 'WEBHOOK' | 'DATABASE_EVENT';
  display_name: string;
  description: string;
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    description?: string;
    placeholder?: string;
  }>;
}

export const PREDEFINED_TRIGGERS: TriggerDefinition[] = [
  {
    type: 'MANUAL',
    display_name: 'Manual Execution',
    description: 'Execute agent manually via API calls or UI',
    parameters: []
  },
  {
    type: 'CRON',
    display_name: 'Scheduled (Cron)',
    description: 'Execute agent on a schedule using cron expressions',
    parameters: [
      {
        name: 'cron',
        type: 'string',
        required: true,
        description: 'Cron expression for scheduling',
        placeholder: '0 9 * * MON-FRI (Every weekday at 9 AM)'
      }
    ]
  },
  {
    type: 'WEBHOOK',
    display_name: 'Webhook Trigger',
    description: 'Execute agent when webhook is called',
    parameters: [
      {
        name: 'webhook_url',
        type: 'string',
        required: true,
        description: 'Webhook endpoint URL',
        placeholder: '/api/webhook/agent-123'
      },
      {
        name: 'webhook_secret',
        type: 'string',
        required: false,
        description: 'Secret for webhook verification',
        placeholder: 'Optional security token'
      }
    ]
  },
  {
    type: 'DATABASE_EVENT',
    display_name: 'Database Event',
    description: 'Execute agent when database table changes',
    parameters: [
      {
        name: 'table_id',
        type: 'string',
        required: true,
        description: 'Database table ID to monitor',
        placeholder: 'Select table to monitor'
      }
    ]
  }
];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => tool.category === category);
}

/**
 * Get all tool categories
 */
export function getToolCategories(): string[] {
  return Array.from(new Set(PREDEFINED_TOOLS.map(tool => tool.category)));
}

/**
 * Find tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return PREDEFINED_TOOLS.find(tool => tool.name === name);
}

/**
 * Get servers by category
 */
export function getServersByCategory(category: string): ServerDefinition[] {
  return PREDEFINED_SERVERS.filter(server => server.category === category);
}

/**
 * Find server by name
 */
export function getServerByName(name: string): ServerDefinition | undefined {
  return PREDEFINED_SERVERS.find(server => server.name === name);
}

/**
 * Get tools that require OAuth authentication
 */
export function getOAuthTools(): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => tool.requires_auth);
}

/**
 * Get tools that don't require OAuth authentication
 */
export function getNonOAuthTools(): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => !tool.requires_auth);
}

/**
 * Get tools by OAuth service
 */
export function getToolsByOAuthService(service: string): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => tool.oauth_service === service);
}

/**
 * Get all unique OAuth services used by tools
 */
export function getRequiredOAuthServices(): string[] {
  return Array.from(new Set(
    PREDEFINED_TOOLS
      .filter(tool => tool.requires_auth && tool.oauth_service)
      .map(tool => tool.oauth_service!)
  ));
}

/**
 * Check if a tool is available for a user based on their OAuth connections
 * @param toolName Name of the tool to check
 * @param userConnections Array of user's connected OAuth services
 */
export function isToolAvailableForUser(toolName: string, userConnections: string[]): boolean {
  const tool = getToolByName(toolName);
  if (!tool) return false;
  
  // If tool doesn't require auth, it's always available
  if (!tool.requires_auth) return true;
  
  // If tool requires auth, check if user has the required OAuth connection
  return tool.oauth_service ? userConnections.includes(tool.oauth_service) : false;
}

/**
 * Get available tools for a user based on their OAuth connections
 * @param userConnections Array of user's connected OAuth services  
 */
export function getAvailableToolsForUser(userConnections: string[]): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => 
    isToolAvailableForUser(tool.name, userConnections)
  );
}

/**
 * Get unavailable tools for a user (OAuth required but not connected)
 * @param userConnections Array of user's connected OAuth services
 */
export function getUnavailableToolsForUser(userConnections: string[]): ToolDefinition[] {
  return PREDEFINED_TOOLS.filter(tool => 
    tool.requires_auth && !isToolAvailableForUser(tool.name, userConnections)
  );
}

// AIDEV-NOTE: This registry provides OAuth-aware tool management for agent workflows
// AIDEV-NOTE: Tools are mapped to existing OAuth connections (gmail, slack, github, etc.)
// AIDEV-NOTE: Agent owners must have connected the required OAuth services to use those tools
// AIDEV-TODO: Add validation for tool parameters and configurations
// AIDEV-TODO: Consider adding tool versioning for backward compatibility
// AIDEV-TODO: Add real-time OAuth connection status checking