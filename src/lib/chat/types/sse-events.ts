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
 * Awaiting input event - unified HITL mechanism
 * Emitted when agent needs user input (plan approval or question)
 *
 * AIDEV-NOTE: This is the unified HITL event type that supports:
 * - plan_approval: Agent has a plan and needs user to approve before execution
 * - question: Agent is uncertain and needs user to choose from options
 */
export interface AwaitingInputEvent {
  type: 'awaiting_input'
  inputType: 'plan_approval' | 'question'
  title: string
  content: string
  options: InputOption[]
  planJson?: string  // Full plan JSON for plan_approval type
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
