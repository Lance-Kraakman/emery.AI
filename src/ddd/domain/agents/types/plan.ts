/**
 * Plan Types
 *
 * Type definitions for agent and skill step execution plans.
 * Plans contain generated detailed execution instructions with tool calls.
 *
 * Two levels of instructions:
 * 1. Basic Instructions: Human-readable, high-level (stored on entity description/instructions)
 * 2. Plan File: Generated detailed execution plan with tool calls (stored in plan JSONB)
 */

/**
 * Status of a plan step during execution
 */
export type PlanStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * Status of the overall plan
 */
export type PlanStatus = 'draft' | 'approved' | 'executing' | 'completed' | 'failed';

/**
 * Individual step within a plan
 */
export interface PlanStep {
  stepId: string;                           // Unique identifier for the step
  description: string;                       // Human-readable description of what this step does
  toolCall?: string;                        // Tool to execute, e.g., "row_crud:read", "tool_executor"
  parameters?: Record<string, unknown>;     // Parameters for the tool call
  contextTables?: string[];                 // Tables this step needs access to
  status: PlanStepStatus;                   // Current execution status
  result?: string;                          // Result of execution (if completed)
  error?: string;                           // Error message (if failed)
}

/**
 * Agent Plan - orchestration logic for how an agent executes
 *
 * Generated from basic instructions (agent description/instructions).
 * Contains step-by-step tool calls for execution.
 */
export interface AgentPlan {
  id: string;                               // Unique plan identifier (UUID)
  goal: string;                             // High-level goal this plan achieves
  basicInstructions: string;                // Original instructions this plan was generated from
  steps: PlanStep[];                        // Ordered list of execution steps
  status: PlanStatus;                       // Current plan status
  generatedAt?: string;                     // ISO timestamp when plan was generated
  approvedAt?: string;                      // ISO timestamp when plan was approved
  version?: number;                         // Plan version for tracking updates
}

/**
 * Skill Step Plan - detailed execution plan for agentic steps
 *
 * Extends AgentPlan with parent skill context.
 * Used for steps that have LLM decision-making (executionType: 'agentic').
 */
export interface StepPlan extends AgentPlan {
  parentSkillId: number;                    // Parent skill this step belongs to
  parentStepId: string;                     // Step ID within the skill
}

/**
 * Helper to create an empty plan
 */
export function createEmptyPlan(goal: string, basicInstructions: string): AgentPlan {
  return {
    id: crypto.randomUUID(),
    goal,
    basicInstructions,
    steps: [],
    status: 'draft',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to create a plan step
 */
export function createPlanStep(
  stepId: string,
  description: string,
  options?: {
    toolCall?: string;
    parameters?: Record<string, unknown>;
    contextTables?: string[];
  }
): PlanStep {
  return {
    stepId,
    description,
    toolCall: options?.toolCall,
    parameters: options?.parameters,
    contextTables: options?.contextTables,
    status: 'pending',
  };
}
