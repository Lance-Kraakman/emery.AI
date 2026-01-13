/**
 * AIDEV-NOTE: Promptfoo provider for Human-in-the-Loop (HITL) workflow testing
 *
 * Tests multi-turn agent workflows with approval steps:
 * 1. Initial request → Agent creates plan
 * 2. Check if waiting for approval
 * 3. Send approval/feedback → Agent executes
 *
 * Environment variables:
 *   EMERY_BASE_URL - API base URL (e.g., http://localhost:3002)
 *   EMERY_API_KEY  - User API key (user_xxx format)
 */

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ProviderContext {
  vars: {
    agentId: string;
    initialTask: string;
    approval: string;        // "yes", "no", or custom feedback
    maxTurns?: number;       // Max conversation turns (default 3)
    timeout?: number;        // Request timeout in ms
  };
}

interface HITLResult {
  turns: number;
  finalResponse: string;
  waitedForApproval: boolean;
  conversation: Message[];
  success: boolean;
  error?: string;
}

interface ProviderResponse {
  output: string;
  error?: string;
}

const BASE_URL = process.env.EMERY_BASE_URL || 'http://localhost:3002';
const API_KEY = process.env.EMERY_API_KEY || '';
const DEFAULT_AGENT_ID = process.env.TEST_AGENT_ID || '1';
const DEFAULT_SCHEMA_BUILDER_AGENT_ID = process.env.SCHEMA_BUILDER_AGENT_ID || '1';

/**
 * Resolves a variable value, handling unsubstituted template placeholders
 */
function resolveVar(value: string | undefined, envKey: string, defaultValue: string): string {
  if (!value || value.includes('{{')) {
    const envValue = process.env[envKey];
    return envValue || defaultValue;
  }
  return value;
}

/**
 * Resolves agent ID, checking for specific agent type placeholders
 */
function resolveAgentId(value: string | undefined): string {
  if (!value || value.includes('{{')) {
    // Check for specific agent types
    if (value?.includes('SCHEMA_BUILDER')) {
      return resolveVar(value, 'SCHEMA_BUILDER_AGENT_ID', DEFAULT_SCHEMA_BUILDER_AGENT_ID);
    }
    return resolveVar(value, 'TEST_AGENT_ID', DEFAULT_AGENT_ID);
  }
  return value;
}

// Indicators that agent is waiting for user approval
const APPROVAL_INDICATORS = [
  "reply 'yes'",
  "reply yes",
  "approve",
  "confirm",
  "proceed",
  "waiting for",
  "let me know",
  "would you like me to",
  "shall i",
  "do you want me to",
  "ready to create",
  "ready to proceed",
];

/**
 * Check if response indicates waiting for approval
 */
function isWaitingForApproval(response: string): boolean {
  const lower = response.toLowerCase();
  return APPROVAL_INDICATORS.some(indicator => lower.includes(indicator));
}

/**
 * Execute agent with conversation history
 */
async function executeAgent(
  agentId: string,
  instruction: string,
  conversationHistory: Message[] = [],
  timeout: number = 120000
): Promise<{ output: string; success: boolean; error?: string }> {
  const url = `${BASE_URL}/api/agents/${agentId}/execute`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instructions: instruction,
      conversationHistory,
      timeout,
      metadata: {
        evalRun: true,
        testType: 'hitl-workflow',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      output: '',
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    };
  }

  const result = await response.json() as { success: boolean; output?: string; error?: string };
  return {
    output: result.output || JSON.stringify(result),
    success: result.success !== false,
    error: result.error,
  };
}

/**
 * Run full HITL workflow
 */
async function runHITLWorkflow(
  agentId: string,
  initialTask: string,
  approval: string,
  maxTurns: number = 3,
  timeout: number = 120000
): Promise<HITLResult> {
  const conversation: Message[] = [];
  let waitedForApproval = false;

  // Turn 1: Send initial task
  conversation.push({ role: 'user', content: initialTask });
  const turn1 = await executeAgent(agentId, initialTask, [], timeout);

  if (!turn1.success) {
    return {
      turns: 1,
      finalResponse: turn1.output,
      waitedForApproval: false,
      conversation,
      success: false,
      error: turn1.error,
    };
  }

  conversation.push({ role: 'assistant', content: turn1.output });

  // Check if waiting for approval
  if (isWaitingForApproval(turn1.output)) {
    waitedForApproval = true;

    // Turn 2: Send approval/feedback
    conversation.push({ role: 'user', content: approval });
    const turn2 = await executeAgent(agentId, approval, conversation, timeout);

    conversation.push({ role: 'assistant', content: turn2.output });

    // If feedback was given (not just "yes"), check for another approval cycle
    const isSimpleApproval = ['yes', 'ok', 'proceed', 'approve', 'go ahead'].some(
      word => approval.toLowerCase().trim() === word
    );

    if (!isSimpleApproval && isWaitingForApproval(turn2.output) && conversation.length / 2 < maxTurns) {
      // Turn 3: Send final approval after feedback
      conversation.push({ role: 'user', content: 'yes' });
      const turn3 = await executeAgent(agentId, 'yes', conversation, timeout);
      conversation.push({ role: 'assistant', content: turn3.output });

      return {
        turns: 3,
        finalResponse: turn3.output,
        waitedForApproval: true,
        conversation,
        success: turn3.success,
        error: turn3.error,
      };
    }

    return {
      turns: 2,
      finalResponse: turn2.output,
      waitedForApproval: true,
      conversation,
      success: turn2.success,
      error: turn2.error,
    };
  }

  // Agent completed without needing approval
  return {
    turns: 1,
    finalResponse: turn1.output,
    waitedForApproval: false,
    conversation,
    success: true,
  };
}

/**
 * Promptfoo ApiProvider class for HITL workflow testing
 */
class HITLProvider {
  id(): string {
    return 'emery-hitl';
  }

  async callApi(prompt: string, context?: { vars?: Record<string, unknown> }): Promise<ProviderResponse> {
    const vars = (context?.vars || {}) as ProviderContext['vars'];
    const { initialTask, approval, maxTurns, timeout } = vars;
    // Resolve agent ID, handling template placeholders
    const resolvedAgentId = resolveAgentId(vars.agentId);

    if (!resolvedAgentId || !initialTask) {
      return {
        output: JSON.stringify({
          success: false,
          error: 'agentId and initialTask are required',
        }),
        error: 'Missing required variables',
      };
    }

    try {
      const result = await runHITLWorkflow(
        resolvedAgentId,
        initialTask,
        approval || 'yes',
        maxTurns || 3,
        timeout || 120000
      );

      return {
        output: JSON.stringify(result),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        output: JSON.stringify({
          success: false,
          error: errorMessage,
          turns: 0,
          finalResponse: '',
          waitedForApproval: false,
          conversation: [],
        }),
        error: errorMessage,
      };
    }
  }
}

export default HITLProvider;
