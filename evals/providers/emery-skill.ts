/**
 * AIDEV-NOTE: Promptfoo custom provider for Emery skill/agent execution
 *
 * Executes agent tasks via POST /api/agents/[id]/execute
 * Uses types from the main application for type safety.
 *
 * Environment variables:
 *   EMERY_BASE_URL - API base URL (e.g., http://localhost:3002)
 *   EMERY_API_KEY  - User API key (user_xxx format)
 *   TEST_AGENT_ID  - Default agent ID for tests
 */

import type {
  AgentExecuteRequest,
  AgentExecuteResponse,
} from '@app/app/api/agents/[id]/execute/route';

// Provider context from promptfoo
interface ProviderContext {
  vars: {
    agentId?: string;
    skillName?: string;
    tools?: AgentExecuteRequest['tools'];
    metadata?: AgentExecuteRequest['metadata'];
    timeout?: number;
  };
}

// Provider response for promptfoo
interface ProviderResponse {
  output: AgentExecuteResponse | { success: boolean; error?: string };
  tokenUsage?: {
    total: number;
    prompt: number;
    completion: number;
  };
  error?: string;
}

const BASE_URL = process.env.EMERY_BASE_URL || 'http://localhost:3002';
const API_KEY = process.env.EMERY_API_KEY || '';
const DEFAULT_AGENT_ID = process.env.TEST_AGENT_ID || '1';

/**
 * Execute an agent with the given instructions
 */
async function executeAgent(
  agentId: string,
  request: AgentExecuteRequest
): Promise<AgentExecuteResponse> {
  const url = `${BASE_URL}/api/agents/${agentId}/execute`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    };
  }

  return response.json() as Promise<AgentExecuteResponse>;
}

/**
 * Main provider function called by promptfoo
 *
 * @param prompt - The instruction/prompt to execute
 * @param context - Context with variables from the test
 */
export default async function executeSkill(
  prompt: string,
  context: ProviderContext
): Promise<ProviderResponse> {
  const { vars } = context;
  const agentId = vars.agentId || DEFAULT_AGENT_ID;

  try {
    const request: AgentExecuteRequest = {
      instructions: prompt,
      tools: vars.tools || [],
      metadata: {
        skillName: vars.skillName,
        evalRun: true,
        timestamp: new Date().toISOString(),
        ...vars.metadata,
      },
      timeout: vars.timeout || 30000,
    };

    const result = await executeAgent(agentId, request);

    if (!result.success) {
      return {
        output: result,
        error: result.error,
      };
    }

    return {
      output: result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      output: { success: false, error: errorMessage },
      error: errorMessage,
    };
  }
}
