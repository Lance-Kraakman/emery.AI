'use client';

/**
 * useChatVariables Hook & Utility Functions
 *
 * Shared logic for converting various variable sources to the format
 * expected by UnifiedChatInput for variable autocomplete.
 *
 * Used by:
 * - AgenticSkillEditor (inputs + data sources)
 * - AgenticConfig (workflow variables)
 */

import { useMemo } from 'react';
import type { InputDefinition } from '@/app/mappers/skill-mapper';
import type { ContextMappingDTO } from '@/app/actions/context-mappings';
import type { WorkflowVariable } from '@/components/workflow-canvas/WorkflowVariableInput';

export interface ChatVariable {
  name: string;
  description: string;
}

/**
 * Convert skill inputs to chat variables
 */
export function inputsToChatVariables(inputs: InputDefinition[]): ChatVariable[] {
  return inputs.map((input) => ({
    name: input.name,
    description: `Input: ${input.type || 'text'}${input.required ? ' (required)' : ''}`,
  }));
}

/**
 * Convert data sources to chat variables
 */
export function dataSourcesToChatVariables(dataSources: ContextMappingDTO[]): ChatVariable[] {
  return dataSources.map((ds) => ({
    name: ds.tableName,
    description: `Data Source (${ds.accessMode})`,
  }));
}

/**
 * Convert workflow variables to chat variables
 */
export function workflowVariablesToChatVariables(variables: WorkflowVariable[]): ChatVariable[] {
  return variables.map((v) => ({
    name: v.name,
    description: v.description || v.label || '',
  }));
}

/**
 * Hook to build chat variables from multiple sources
 *
 * @example
 * // Skill-level editor (inputs + data sources)
 * const chatVariables = useChatVariables({
 *   inputs: value.inputs,
 *   dataSources,
 * });
 *
 * @example
 * // Workflow node (workflow variables only)
 * const chatVariables = useChatVariables({
 *   workflowVariables: variables,
 * });
 */
export function useChatVariables(options: {
  inputs?: InputDefinition[];
  dataSources?: ContextMappingDTO[];
  workflowVariables?: WorkflowVariable[];
}): ChatVariable[] {
  const { inputs = [], dataSources = [], workflowVariables = [] } = options;

  return useMemo(() => {
    const vars: ChatVariable[] = [];

    // Add workflow variables first (for node config, these are the primary variables)
    if (workflowVariables.length > 0) {
      vars.push(...workflowVariablesToChatVariables(workflowVariables));
    }

    // Add inputs (for skill-level editor)
    if (inputs.length > 0) {
      vars.push(...inputsToChatVariables(inputs));
    }

    // Add data sources
    if (dataSources.length > 0) {
      vars.push(...dataSourcesToChatVariables(dataSources));
    }

    return vars;
  }, [inputs, dataSources, workflowVariables]);
}
