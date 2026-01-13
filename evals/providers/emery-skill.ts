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
const DEFAULT_SCHEMA_BUILDER_AGENT_ID = process.env.SCHEMA_BUILDER_AGENT_ID || '1';
const DEFAULT_SKILL_BUILDER_AGENT_ID = process.env.SKILL_BUILDER_AGENT_ID || '1';

const DEFAULT_TABLE_ID = process.env.TEST_TABLE_ID || '1';

/**
 * Resolves a variable value, handling unsubstituted template placeholders
 */
function resolveVar(value: string | undefined, envKey: string, defaultValue: string): string {
  // If value is undefined, empty, or an unsubstituted template placeholder, use default
  if (!value || value.includes('{{')) {
    // Try environment variable first
    const envValue = process.env[envKey];
    return envValue || defaultValue;
  }
  return value;
}

/**
 * Replace template placeholders in prompt string with actual values
 */
function resolvePromptVars(prompt: string): string {
  return prompt.replace(/\{\{TEST_TABLE_ID\}\}/g, DEFAULT_TABLE_ID);
}

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
 * Promptfoo ApiProvider class for skill/agent execution
 */
class EmerySkillProvider {
  id(): string {
    return 'emery-skill';
  }

  async callApi(prompt: string, context?: { vars?: Record<string, unknown> }): Promise<ProviderResponse> {
    const vars = (context?.vars || {}) as ProviderContext['vars'];
    // Resolve agent ID, checking for template placeholders and env vars
    let agentId = resolveVar(vars.agentId, 'TEST_AGENT_ID', DEFAULT_AGENT_ID);
    // Also check for specific agent type placeholders
    if (vars.agentId?.includes('SCHEMA_BUILDER')) {
      agentId = resolveVar(vars.agentId, 'SCHEMA_BUILDER_AGENT_ID', DEFAULT_SCHEMA_BUILDER_AGENT_ID);
    } else if (vars.agentId?.includes('SKILL_BUILDER')) {
      agentId = resolveVar(vars.agentId, 'SKILL_BUILDER_AGENT_ID', DEFAULT_SKILL_BUILDER_AGENT_ID);
    }

    // Resolve any template placeholders in the prompt
    const resolvedPrompt = resolvePromptVars(prompt);

    try {
      const request: AgentExecuteRequest = {
        instructions: resolvedPrompt,
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
}

export default EmerySkillProvider;
