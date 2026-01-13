/**
 * AIDEV-NOTE: Promptfoo provider for testing tool_executor natural language translation
 *
 * Tests that natural language tasks are correctly translated to CRUD operations.
 * Uses the agent execute endpoint with tool_executor tool.
 *
 * Environment variables:
 *   EMERY_BASE_URL - API base URL (e.g., http://localhost:3002)
 *   EMERY_API_KEY  - User API key (user_xxx format)
 *   TEST_AGENT_ID  - Agent ID that has tool_executor configured
 */

interface ProviderContext {
  vars: {
    tool: string;      // Tool name: database_crud, table_crud, field_crud
    task: string;      // Natural language task description
    agentId?: string;  // Optional override for agent ID
    timeout?: number;  // Request timeout in ms
  };
}

interface ProviderResponse {
  output: string;
  error?: string;
}

const BASE_URL = process.env.EMERY_BASE_URL || 'http://localhost:3002';
const API_KEY = process.env.EMERY_API_KEY || '';
const DEFAULT_AGENT_ID = process.env.TEST_AGENT_ID || '1';

/**
 * Execute tool_executor via agent
 */
async function executeToolExecutor(
  agentId: string,
  tool: string,
  task: string,
  timeout: number = 60000
): Promise<unknown> {
  const url = `${BASE_URL}/api/agents/${agentId}/execute`;

  // Construct instruction that mimics how schema_builder uses tool_executor
  const instructions = `Execute this tool call and return the result:
tool_executor(tool="${tool}", task="${task}")

Return only the tool result, no additional commentary.`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instructions,
      tools: ['tool_executor'],
      timeout,
      metadata: {
        evalRun: true,
        testType: 'tool-executor',
        tool,
        task,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    };
  }

  return response.json();
}

/**
 * Main provider function called by promptfoo
 */
export default async function toolExecutorProvider(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse> {
  const { vars } = context;
  const { tool, task, agentId, timeout } = vars;

  if (!tool || !task) {
    return {
      output: JSON.stringify({
        success: false,
        error: 'Both "tool" and "task" variables are required',
      }),
      error: 'Missing required variables',
    };
  }

  try {
    const result = await executeToolExecutor(
      agentId || DEFAULT_AGENT_ID,
      tool,
      task,
      timeout || 60000
    );

    return {
      output: JSON.stringify(result),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      output: JSON.stringify({ success: false, error: errorMessage }),
      error: errorMessage,
    };
  }
}
