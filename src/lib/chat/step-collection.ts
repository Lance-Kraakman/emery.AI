import type { ExecutionStep, ExecutionStepMetadata } from '@/ddd/domain/chat/value-objects/execution-step'

/**
 * Create an execution step with proper typing
 */
export function createExecutionStep(
  stepType: string,
  stepName: string,
  stepIndex: number,
  content: string,
  metadata?: Record<string, any>
): ExecutionStep {
  return {
    type: stepType as ExecutionStep['type'],
    name: stepName,
    content: content,
    index: stepIndex,
    timestamp: Date.now(),
    metadata: metadata as ExecutionStepMetadata
  }
}

/**
 * Add step with deduplication
 *
 * Note: O(n) search is acceptable here because step arrays are small (typically 3-10 items)
 * and the backend already sends unique steps. This is a safety check for edge cases.
 */
export function addStepDeduped(
  steps: ExecutionStep[],
  newStep: ExecutionStep
): ExecutionStep[] {
  const exists = steps.find(
    s => s.index === newStep.index && s.type === newStep.type
  )
  return exists ? steps : [...steps, newStep]
}

/**
 * Create a unique key for step deduplication
 */
export function getStepKey(step: ExecutionStep): string {
  return `${step.index}-${step.type}`
}
