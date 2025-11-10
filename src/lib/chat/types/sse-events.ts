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
    ragSources: any[]
    modelUsed: string
    totalTokens: number
  }
}

/**
 * RAG context event with sources
 */
export interface RagContextEvent {
  type: 'rag_context'
  sources: any[]
  contextUsed: boolean
}

/**
 * Union type for all SSE chat events
 */
export type SSEChatEvent =
  | StepProgressEvent
  | ContentEvent
  | MessageCompleteEvent
  | RagContextEvent

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

export function isRagContextEvent(event: any): event is RagContextEvent {
  return event?.type === 'rag_context'
}
