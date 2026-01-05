/**
 * Shared types for node configuration components.
 */

import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';
import type { InputDefinition } from '@/app/mappers/skill-mapper';
import type {
  WorkflowNodeData,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
  ReadNodeData,
  AvailableSkill,
} from '@/components/workflow-canvas/types';

/**
 * Base props shared by all config components
 */
export interface BaseConfigProps<T extends WorkflowNodeData = WorkflowNodeData> {
  data: T;
  onUpdate: (updates: Partial<WorkflowNodeData>) => void;
  disabled?: boolean;
}

/**
 * Config props with workflow variables (for expression inputs)
 */
export interface ConfigWithVariables<T extends WorkflowNodeData> extends BaseConfigProps<T> {
  variables: WorkflowVariable[];
}

/**
 * Config props with skill inputs (for tool/write nodes)
 */
export interface ConfigWithSkillInputs<T extends WorkflowNodeData> extends BaseConfigProps<T> {
  skillInputs: InputDefinition[];
}

/**
 * Config props with workflow variables (for write field mapping, read row ID)
 */
export interface ConfigWithWorkflowVariables<T extends WorkflowNodeData> extends BaseConfigProps<T> {
  workflowVariables: WorkflowVariable[];
}

/**
 * Config props with available skills (for skill ref nodes)
 */
export interface ConfigWithSkills<T extends WorkflowNodeData> extends BaseConfigProps<T> {
  availableSkills: AvailableSkill[];
}

// Re-export node data types for convenience
export type {
  WorkflowNodeData,
  SkillRefNodeData,
  ConditionNodeData,
  LoopNodeData,
  AgenticNodeData,
  OperationNodeData,
  ToolNodeData,
  WriteNodeData,
  ReadNodeData,
  AvailableSkill,
  WorkflowVariable,
  InputDefinition,
};
