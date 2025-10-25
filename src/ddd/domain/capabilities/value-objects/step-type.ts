/**
 * Step Type Enumeration
 *
 * Defines the types of steps that can be part of a capability.
 * - TOOL_STEP: Step that uses tools to accomplish a task
 * - CODE_STEP: Step that executes code directly
 */
export enum StepType {
  TOOL_STEP = 'TOOL_STEP',
  CODE_STEP = 'CODE_STEP'
}

/**
 * StepType Value Object
 *
 * Encapsulates step type with validation and helper methods.
 */
export class StepTypeVO {
  private constructor(public readonly value: StepType) {}

  static fromString(value: string): StepTypeVO {
    if (!Object.values(StepType).includes(value as StepType)) {
      throw new Error(`Invalid step type: ${value}. Must be TOOL_STEP or CODE_STEP`);
    }
    return new StepTypeVO(value as StepType);
  }

  static toolStep(): StepTypeVO {
    return new StepTypeVO(StepType.TOOL_STEP);
  }

  static codeStep(): StepTypeVO {
    return new StepTypeVO(StepType.CODE_STEP);
  }

  isToolStep(): boolean {
    return this.value === StepType.TOOL_STEP;
  }

  isCodeStep(): boolean {
    return this.value === StepType.CODE_STEP;
  }

  toString(): string {
    return this.value;
  }

  equals(other: StepTypeVO): boolean {
    return this.value === other.value;
  }
}
