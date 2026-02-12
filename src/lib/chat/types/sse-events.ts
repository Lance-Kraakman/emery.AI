import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step'

/**
 * Step progress event from backend
 */
export interface StepProgressEvent {
  type: 'step_progress'
  stepType: string
  stepName: string
  stepIndex: number
  content: string
  metadata?: Record<string, string>
}

/**
 * Content chunk event from backend
 */
export interface ContentEvent {
  type: 'content'
  text: string
}

/**
 * Message completion event with metadata
 */
export interface MessageCompleteEvent {
  type: 'message_complete'
  metadata: {
    executionSteps: ExecutionStep[]
    modelUsed: string
    totalTokens: number
    tokenUsage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
      modelName: string
      costUsd?: number
    }
  }
}

/**
 * Plan step in a plan approval request
 */
export interface PlanStepData {
  index: number
  description: string
  toolName?: string
  toolArgs?: Record<string, any>
  status?: 'pending' | 'in_progress' | 'completed' | 'failed'
  connectionRequired?: string  // App slug requiring OAuth connection (e.g., "slack", "gmail")
}

/**
 * Plan approval request event from backend
 * Emitted when the agent has created a plan and needs user approval before execution
 */
export interface PlanApprovalRequestEvent {
  type: 'plan_approval_request'
  planId: string
  goal: string
  steps: PlanStepData[]
  estimatedActions?: number
  contextTables?: string[]
  context?: string   // What was discovered (existing databases, tables, etc.)
  analysis?: string  // Analysis/reasoning about what will be done
}

/**
 * Plan status update event
 * Emitted during plan execution to update step progress
 */
export interface PlanStatusUpdateEvent {
  type: 'plan_status_update'
  planId: string
  status: 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled'
  currentStepIndex?: number
  completedSteps?: number[]
  failedSteps?: number[]
  error?: string
}

/**
 * Option for HITL questions/choices
 */
export interface InputOption {
  id: string
  label: string
  description?: string
}

/**
 * Question section with agent context
 */
export interface QuestionSection {
  agentName: string
  stepId: string
  questions: Array<{
    questionId: string
    question: string
    questionType?: 'text' | 'single_select' | 'multi_select'  // Default: 'text' or 'single_select' if options
    options?: string[]
    context?: string
    required?: boolean
    allowOther?: boolean  // Show "Or type your own..." option (default: true)
  }>
}

/**
 * Awaiting input event - unified HITL mechanism
 * Emitted when agent needs user input (plan approval or questions)
 *
 * AIDEV-NOTE: Simplified to 2 types:
 * - plan_approval: Shows approve/reject buttons (plan content in chat message)
 * - questions: Shows clarifying questions with structured UI
 */
export interface AwaitingInputEvent {
  type: 'awaiting_input'
  inputType: 'plan_approval' | 'questions'
  title: string
  content: string
  options: InputOption[]
  planJson?: string
  questionSections?: QuestionSection[]  // Ready-to-use question sections from API
}

/**
 * Permission request event
 * Emitted when agent encounters a permission error and needs user to grant access
 *
 * AIDEV-NOTE: This event is emitted by the Python agent layer when a tool
 * receives a 403 permission error from the API. The UI shows an inline
 * permission request allowing the user to grant or deny access.
 */
export interface PermissionRequestEvent {
  type: 'permission_request'
  permission: string        // Full permission string (e.g., "database:view")
  resource?: string         // Resource type (e.g., "database")
  resourceId?: number       // Specific resource ID if applicable
  action: string            // Action being attempted (e.g., "view")
  context?: string          // Description of what agent was trying to do
  metadata?: {
    requires_user_action: boolean
    can_continue_without: boolean
  }
}

/**
 * Output definition for human skill completion
 */
export interface HumanSkillOutput {
  name: string
  type: string
  description?: string
}

/**
 * Input value provided to human skill
 */
export interface HumanSkillInput {
  name: string
  type: string
  value: string
}

/**
 * Awaiting human skill event
 * Emitted when execution reaches a human skill and needs human action
 *
 * AIDEV-NOTE: Stream closes after this event. Frontend shows completion UI,
 * user submits outputs, new message resumes execution with the outputs.
 */
export interface AwaitingHumanSkillEvent {
  type: 'awaiting_human_skill'
  skillId: number
  skillName: string
  stepId: string              // Empty for top-level skill, set for workflow step
  instructions: string        // What human needs to do (markdown)
  inputs: HumanSkillInput[]   // Context from execution
  outputSchema: HumanSkillOutput[]  // What human needs to provide
  assignedTo: string          // User ID assigned to complete
  externalLinks: string[]     // Optional URLs for external work
  sessionId: string           // For resuming execution
}

/**
 * Tool loaded event
 * Emitted when a tool is dynamically loaded during execution
 *
 * AIDEV-NOTE: Emitted by PlanStepExecutor when step.tool_call specifies
 * a tool not in available tools and it's dynamically loaded.
 * Frontend uses this to update the ToolPanel UI.
 */
export interface ToolLoadedEvent {
  type: 'tool_loaded'
  toolName: string        // e.g., "gmail_find_email"
  toolDisplayName: string // Human-readable name
  toolDescription: string
  appName: string         // e.g., "gmail" - for grouping/icon display
}

/**
 * Union type for all SSE chat events
 */
export type SSEChatEvent =
  | StepProgressEvent
  | ContentEvent
  | MessageCompleteEvent
  | PlanApprovalRequestEvent
  | PlanStatusUpdateEvent
  | AwaitingInputEvent
  | PermissionRequestEvent
  | AwaitingHumanSkillEvent
  | ToolLoadedEvent

/**
 * Type guards for event discrimination
 */
export function isStepProgressEvent(event: any): event is StepProgressEvent {
  return event?.type === 'step_progress'
}

export function isContentEvent(event: any): event is ContentEvent {
  return event?.type === 'content'
}

export function isMessageCompleteEvent(event: any): event is MessageCompleteEvent {
  return event?.type === 'message_complete'
}

export function isPlanApprovalRequestEvent(event: any): event is PlanApprovalRequestEvent {
  return event?.type === 'plan_approval_request'
}

export function isPlanStatusUpdateEvent(event: any): event is PlanStatusUpdateEvent {
  return event?.type === 'plan_status_update'
}

export function isAwaitingInputEvent(event: any): event is AwaitingInputEvent {
  return event?.type === 'awaiting_input'
}

export function isPermissionRequestEvent(event: any): event is PermissionRequestEvent {
  return event?.type === 'permission_request'
}

export function isAwaitingHumanSkillEvent(event: any): event is AwaitingHumanSkillEvent {
  return event?.type === 'awaiting_human_skill'
}

export function isToolLoadedEvent(event: any): event is ToolLoadedEvent {
  return event?.type === 'tool_loaded'
}

/**
 * Extract app name from tool name.
 *
 * Convention: External tool names follow the pattern "{app}_{action}"
 * e.g., "gmail_find_email" -> "gmail", "slack_send_message" -> "slack"
 *
 * @param toolName Full tool name
 * @returns App name (prefix before first underscore, or full name if no underscore)
 */
export function extractAppName(toolName: string): string {
  return toolName.includes('_') ? toolName.split('_')[0] : toolName
}
