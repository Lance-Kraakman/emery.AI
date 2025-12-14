import { Brain, Wrench, Lightbulb, CheckCircle2, Code } from 'lucide-react'

/**
 * Step type constants - single source of truth
 *
 * AIDEV-NOTE: CODE_EXECUTION added for CodeAgent steps that execute Python code
 * instead of calling tools via structured function calls.
 */
export const STEP_TYPES = {
  PLANNING: 'PLANNING',
  ACTION: 'ACTION',
  REASONING: 'REASONING',
  CODE_EXECUTION: 'CODE_EXECUTION',
  FINAL: 'FINAL'
} as const

export type StepType = typeof STEP_TYPES[keyof typeof STEP_TYPES]

/**
 * Array of step types in order (matches protobuf enum)
 */
export const STEP_TYPE_ARRAY = ['PLANNING', 'ACTION', 'REASONING', 'CODE_EXECUTION', 'FINAL'] as const

/**
 * Step configuration with icons, colors, and labels
 */
export const STEP_CONFIG = {
  PLANNING: {
    icon: Brain,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Thinking',
    loadingMessage: 'Thinking through the problem...'
  },
  ACTION: {
    icon: Wrench,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Acting',
    loadingMessage: 'Executing action...'
  },
  REASONING: {
    icon: Lightbulb,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Reasoning',
    loadingMessage: 'Processing results...'
  },
  CODE_EXECUTION: {
    icon: Code,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Executing Code',
    loadingMessage: 'Executing Python code...'
  },
  FINAL: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Finalizing',
    loadingMessage: 'Finalizing response...'
  }
} as const

/**
 * Get step configuration for a step type
 */
export function getStepConfig(type: string) {
  return STEP_CONFIG[type as StepType] || STEP_CONFIG.PLANNING
}
