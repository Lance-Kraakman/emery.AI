import { STEP_TYPES, STEP_TYPE_ARRAY } from './step-config'
import type { StepType } from './step-config'

/**
 * Validate and normalize step type string
 */
export function validateStepType(stepType: string): StepType {
  const normalized = stepType.toUpperCase()

  if (STEP_TYPE_ARRAY.includes(normalized as any)) {
    return normalized as StepType
  }

  console.warn(`[validateStepType] Invalid step type: ${stepType}, defaulting to PLANNING`)
  return STEP_TYPES.PLANNING
}

/**
 * Convert protobuf step type enum (number) to string
 * Matches protobuf enum values: 0=PLANNING, 1=ACTION, 2=REASONING, 3=FINAL
 */
export function stepTypeEnumToString(stepType: number): StepType {
  const mapping: Record<number, StepType> = {
    0: STEP_TYPES.PLANNING,
    1: STEP_TYPES.ACTION,
    2: STEP_TYPES.REASONING,
    3: STEP_TYPES.FINAL
  }

  return mapping[stepType] || STEP_TYPES.PLANNING
}

/**
 * Validate and normalize execution step metadata
 * Ensures all values are strings
 */
export function validateStepMetadata(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  const validated: Record<string, string> = {}
  const m = metadata as Record<string, unknown>

  // Only include string values, convert others to strings
  for (const [key, value] of Object.entries(m)) {
    if (typeof value === 'string') {
      validated[key] = value
    } else if (value !== null && value !== undefined) {
      validated[key] = String(value)
    }
  }

  return validated
}
