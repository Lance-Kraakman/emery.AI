// Auto-generated from tools-registry.json
// Do not edit manually - run 'node tools/validate-registry.js' to regenerate

export type ToolId = 'python_repl' | 'github_list_repos' | 'github_repo_manager' | 'slack_send_message' | 'gmail_send_email' | 'google_sheets' | 'web_search' | 'data_analyzer' | 'measurement_tracker' | 'document_reader' | 'table_query' | 'notion_database' | 'discord_message' | 'linear_issue' | 'airtable_base';

export type ToolCategory = 'utility' | 'oauth_integration' | 'organizational' | 'reference';

export interface ToolConfig {
  id: ToolId;
  display_name: string;
  description: string;
  category: ToolCategory;
  app: string;
  tags: string[];
  ui_config: {
    icon: string;
    insert_text: string;
    supports_artifacts: boolean;
    preview_description: string;
  };
  implementation: {
    type: 'pipedream' | 'native';
    pipedream_tool_id?: string;
    backend_class?: string;
    requires_auth: boolean;
    auth_provider?: string;
    api_config?: {
      method: string;
      endpoint: string;
    };
  };
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }>;
}

export interface ToolsRegistry {
  version: string;
  metadata: {
    generated_at: string;
    description: string;
    total_curated_tools: number;
  };
  curated_tools: ToolConfig[];
  pipedream_config: {
    enabled: boolean;
    metadata_path: string;
    load_strategy: string;
    fallback_enabled: boolean;
    mcp_suffix: string;
    description: string;
  };
  categories: Record<ToolCategory, string>;
}
