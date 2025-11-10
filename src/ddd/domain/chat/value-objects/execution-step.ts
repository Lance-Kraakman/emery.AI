/**
 * Execution Step Value Objects
 *
 * Represents steps in agent execution for transparency and debugging.
 * Steps are collected during agent processing and persisted in message metadata.
 */

/**
 * Metadata for execution steps
 */
export interface ExecutionStepMetadata {
  tool?: string
  arguments?: string
  observations?: string
  error?: string
}

/**
 * Execution step from agent processing
 *
 * Steps are collected during agent execution and persisted in message metadata.
 * They provide transparency into the agent's reasoning and tool usage.
 */
export interface ExecutionStep {
  type: 'PLANNING' | 'ACTION' | 'REASONING' | 'FINAL'
  name: string
  content: string
  index: number
  timestamp: number
  metadata?: ExecutionStepMetadata
}
