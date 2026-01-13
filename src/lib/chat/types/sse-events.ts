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
 * Union type for all SSE chat events
 */
export type SSEChatEvent =
  | StepProgressEvent
  | ContentEvent
  | MessageCompleteEvent
  | PlanApprovalRequestEvent
  | PlanStatusUpdateEvent

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
