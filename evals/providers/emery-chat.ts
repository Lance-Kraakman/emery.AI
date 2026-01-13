/**
 * AIDEV-NOTE: Promptfoo custom provider for Emery chat/conversation testing
 *
 * Handles multi-turn conversations via agent execution.
 * Useful for testing agent workflows that require back-and-forth.
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

// Chat message format
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Provider context from promptfoo
interface ProviderContext {
  vars: {
    agentId?: string;
    conversationId?: string;
    model?: string;
    metadata?: Record<string, unknown>;
    timeout?: number;
  };
}

// Provider response for promptfoo
interface ProviderResponse {
  output: AgentExecuteResponse | { success: boolean; error?: string; response?: string };
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
 * Send a chat message via agent execution
 */
async function sendChatMessage(
  agentId: string,
  messages: Message[],
  options: {
    conversationId?: string;
    model?: string;
    metadata?: Record<string, unknown>;
    timeout?: number;
  } = {}
): Promise<AgentExecuteResponse> {
  const url = `${BASE_URL}/api/agents/${agentId}/execute`;

  // Extract the last user message as the instruction
  const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
  if (!lastUserMessage) {
    return { success: false, error: 'No user message found' };
  }

  // Build context from previous messages
  const context = messages
    .slice(0, -1)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const instruction = context
    ? `Previous context:\n${context}\n\nCurrent message: ${lastUserMessage.content}`
    : lastUserMessage.content;

  const request: AgentExecuteRequest = {
    instructions: instruction,
    metadata: {
      ...options.metadata,
      conversationId: options.conversationId,
      evalRun: true,
    },
    timeout: options.timeout || 30000,
  };

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
 * Handles both single prompts and multi-turn conversations.
 * For multi-turn, pass an array of messages as the prompt.
 *
 * @param prompt - Single string or array of message objects
 * @param context - Context with variables from the test
 */
export default async function executeChat(
  prompt: string | Message[],
  context: ProviderContext
): Promise<ProviderResponse> {
  const { vars } = context;
  const agentId = vars.agentId || DEFAULT_AGENT_ID;

  try {
    // Convert prompt to messages array
    const messages: Message[] = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user', content: prompt }];

    const result = await sendChatMessage(agentId, messages, {
      conversationId: vars.conversationId,
      model: vars.model,
      metadata: vars.metadata,
      timeout: vars.timeout,
    });

    if (!result.success) {
      return {
        output: result,
        error: result.error,
      };
    }

    return {
      output: {
        ...result,
        response: typeof result.result === 'string'
          ? result.result
          : JSON.stringify(result.result),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      output: { success: false, error: errorMessage },
      error: errorMessage,
    };
  }
}
