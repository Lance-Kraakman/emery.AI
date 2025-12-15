import type { ExecutionStep } from '@/ddd/domain/chat/value-objects/execution-step'
import type { StepProgressEvent, ContentEvent, MessageCompleteEvent } from './types/sse-events'
import { createExecutionStep, addStepDeduped } from './step-collection'
import { stepTypeEnumToString, validateStepMetadata } from './step-validation'

/**
 * Process step progress from gRPC response
 */
export function processStepProgress(
  stepType: number,
  stepName: string,
  stepIndex: number,
  content: string,
  metadata: Record<string, string> | undefined,
  collectedSteps: ExecutionStep[]
): {
  event: StepProgressEvent
  updatedSteps: ExecutionStep[]
} {
  const stepTypeName = stepTypeEnumToString(stepType)
  const validatedMetadata = validateStepMetadata(metadata)

  const executionStep = createExecutionStep(
    stepTypeName,
    stepName,
    stepIndex,
    content,
    validatedMetadata
  )

  return {
    event: {
      type: 'step_progress',
      stepType: stepTypeName,
      stepName,
      stepIndex,
      content,
      metadata: validatedMetadata
    },
    updatedSteps: addStepDeduped(collectedSteps, executionStep)
  }
}

/**
 * Process content chunk from gRPC response
 */
export function processContentChunk(
  content: string,
  fullResponse: string
): {
  event: ContentEvent
  updatedResponse: string
} {
  return {
    event: { type: 'content', text: content },
    updatedResponse: fullResponse + content
  }
}

/**
 * Process completion event with metadata
 */
export function processCompletion(
  modelUsed: string,
  totalTokens: number,
  collectedSteps: ExecutionStep[]
): MessageCompleteEvent {
  return {
    type: 'message_complete',
    metadata: {
      executionSteps: collectedSteps,
      modelUsed,
      totalTokens
    }
  }
}

/**
 * Encode SSE event for streaming
 */
export function encodeSSEEvent(event: any): Uint8Array {
  try {
    const eventData = `data: ${JSON.stringify(event)}\n\n`
    return new TextEncoder().encode(eventData)
  } catch (error) {
    console.error('[encodeSSEEvent] Failed to encode event:', error)
    throw error
  }
}
